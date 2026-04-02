import { Fragment, useMemo, useState } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';
import { getGraphicSurfaceSizeCm } from '../utils/graphics';
import { countStructuralFramesForBooth, recommendedLegCount, recommendedStabilizerCount } from '../utils/booth';

type Line = {
  key: string;
  name: string;
  dimensions: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  unitWeight: number;
  totalWeight: number;
  kind: 'structure' | 'accessories' | 'graphics';
};

type FrameGroup = {
  id: string;
  frameName: string;
  frameLine: Line;
  mountedLines: Line[];
  supportLines: Line[];
  subtotalPrice: number;
  subtotalWeight: number;
};

const fmtEur = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const fmtKg = (value: number) => `${value.toFixed(1)} kg`;
const fmtM2 = (value: number) => `${value.toFixed(2)} m2`;
const GRAPHICS_RATE_EUR_PER_M2 = 23;

export const EstimateWidgetOverlay = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'estimate' | 'ddp'>('estimate');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [compactView, setCompactView] = useState(true);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);
  const boothLegCountOverride = useWizardStore((s) => s.boothLegCountOverride);
  const boothStabilizerCountOverride = useWizardStore((s) => s.boothStabilizerCountOverride);
  const boothLegFootKind = useWizardStore((s) => s.boothLegFootKind);

  const data = useMemo(() => {
    const structuralObjects = sceneObjects.filter((obj) => {
      const c = PRODUCT_BY_ID[obj.productId].category;
      return c === 'frame' || c === 'frame-counter' || c === 'arch';
    });
    const structuralCount = countStructuralFramesForBooth(sceneObjects);
    const recLegs = recommendedLegCount(structuralCount);
    const recStabilizers = recommendedStabilizerCount(structuralCount);
    const effectiveLegs = boothLegCountOverride === null ? recLegs : Math.max(0, boothLegCountOverride);
    const effectiveStabilizers =
      boothStabilizerCountOverride === null ? recStabilizers : Math.max(0, boothStabilizerCountOverride);

    // Deterministic frame order for stable naming and support distribution.
    const sortedStructural = structuralObjects
      .slice()
      .sort((a, b) => a.position[2] - b.position[2] || a.position[0] - b.position[0]);

    const frame96Map: Record<string, string> = {};
    sortedStructural
      .filter((obj) => obj.productId === 'frame-96')
      .forEach((obj, idx) => {
        frame96Map[obj.instanceId] = `Frame 96_${idx + 1}`;
      });
    const getFrameName = (instanceId: string) => {
      const obj = sceneObjects.find((it) => it.instanceId === instanceId);
      if (!obj) return 'Unknown frame';
      return frame96Map[instanceId] ?? PRODUCT_BY_ID[obj.productId].name;
    };

    // Distribute feet/stabilizers per structural instance.
    const legsByFrame = new Map<string, number>();
    const stabilizersByFrame = new Map<string, number>();
    const n = sortedStructural.length;
    const legBase = n > 0 ? Math.floor(effectiveLegs / n) : 0;
    const legRem = n > 0 ? effectiveLegs % n : 0;
    const stBase = n > 0 ? Math.floor(effectiveStabilizers / n) : 0;
    const stRem = n > 0 ? effectiveStabilizers % n : 0;
    sortedStructural.forEach((obj, idx) => {
      legsByFrame.set(obj.instanceId, legBase + (idx < legRem ? 1 : 0));
      stabilizersByFrame.set(obj.instanceId, stBase + (idx < stRem ? 1 : 0));
    });

    const frameGroups: FrameGroup[] = sortedStructural.map((frame) => {
      const frameProduct = PRODUCT_BY_ID[frame.productId];
      const frameLine: Line = {
        key: `${frame.instanceId}-base`,
        name: frameProduct.name,
        dimensions: `${frameProduct.dimensions.width}×${frameProduct.dimensions.height}×${frameProduct.dimensions.depth} cm`,
        qty: 1,
        unitPrice: frameProduct.priceEur,
        totalPrice: frameProduct.priceEur,
        unitWeight: frameProduct.weightKg,
        totalWeight: frameProduct.weightKg,
        kind: 'structure',
      };

      const attached = sceneObjects.filter((obj) => obj.attachedToFrameId === frame.instanceId);
      const attachedQty = new Map<string, number>();
      attached.forEach((obj) => {
        attachedQty.set(obj.productId, (attachedQty.get(obj.productId) ?? 0) + 1);
      });
      const mountedLines: Line[] = [...attachedQty.entries()].map(([productId, qty]) => {
        const p = PRODUCT_BY_ID[productId];
        return {
          key: `${frame.instanceId}-${productId}`,
          name: p.name,
          dimensions: `${p.dimensions.width}×${p.dimensions.height}×${p.dimensions.depth} cm`,
          qty,
          unitPrice: p.priceEur,
          totalPrice: p.priceEur * qty,
          unitWeight: p.weightKg,
          totalWeight: p.weightKg * qty,
          kind: 'accessories',
        };
      });

      const supportLines: Line[] = [];
      const legsQty = legsByFrame.get(frame.instanceId) ?? 0;
      if (legsQty > 0) {
        supportLines.push({
          key: `${frame.instanceId}-legs`,
          name: `Legs (${boothLegFootKind})`,
          dimensions: '—',
          qty: legsQty,
          unitPrice: 0,
          totalPrice: 0,
          unitWeight: 0,
          totalWeight: 0,
          kind: 'accessories',
        });
      }
      const stQty = stabilizersByFrame.get(frame.instanceId) ?? 0;
      if (stQty > 0) {
        supportLines.push({
          key: `${frame.instanceId}-st`,
          name: 'Frame stabilizer',
          dimensions: '—',
          qty: stQty,
          unitPrice: 0,
          totalPrice: 0,
          unitWeight: 0,
          totalWeight: 0,
          kind: 'accessories',
        });
      }

      const subtotalPrice =
        frameLine.totalPrice + mountedLines.reduce((sum, line) => sum + line.totalPrice, 0);
      const subtotalWeight =
        frameLine.totalWeight + mountedLines.reduce((sum, line) => sum + line.totalWeight, 0);

      return {
        id: frame.instanceId,
        frameName: getFrameName(frame.instanceId),
        frameLine,
        mountedLines,
        supportLines,
        subtotalPrice,
        subtotalWeight,
      };
    });

    const graphicsLines: Line[] = Object.keys(frameGraphics).flatMap((objectId) => {
      const object = sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!object) return [];
      const surface = getGraphicSurfaceSizeCm(object.productId);
      const areaM2 = (surface.width * surface.height) / 10000;
      return [
        {
          key: `graphics-${objectId}`,
          name: `${getFrameName(objectId)} graphic print`,
          dimensions: `${surface.width.toFixed(0)}×${surface.height.toFixed(0)} cm`,
          qty: 1,
          unitPrice: GRAPHICS_RATE_EUR_PER_M2,
          totalPrice: areaM2 * GRAPHICS_RATE_EUR_PER_M2,
          unitWeight: 0,
          totalWeight: 0,
          kind: 'graphics',
        },
      ];
    });

    const graphicsAreaM2 = graphicsLines.reduce(
      (sum, line) => sum + line.totalPrice / GRAPHICS_RATE_EUR_PER_M2,
      0,
    );
    const graphicsTotal = graphicsLines.reduce((sum, line) => sum + line.totalPrice, 0);
    const structuralTotal = frameGroups.reduce((sum, group) => sum + group.subtotalPrice, 0);
    const totalPrice = structuralTotal + graphicsTotal;
    const totalWeight = frameGroups.reduce((sum, group) => sum + group.subtotalWeight, 0);

    return {
      graphicsLines,
      frameGroups,
      totalPrice,
      totalWeight,
      structuralTotal,
      graphicsTotal,
      productsCount: sceneObjects.length,
      graphicsAreaM2,
      effectiveLegs,
      effectiveStabilizers,
      recLegs,
      recStabilizers,
    };
  }, [frameGraphics, sceneObjects, boothLegCountOverride, boothStabilizerCountOverride, boothLegFootKind]);

  const toggleGroup = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <div className="estimate-widget">
        <div className="estimate-widget__head">
          <div>
            <div className="estimate-widget__label">Total price</div>
            <div className="estimate-widget__value">{fmtEur(data.totalPrice)}</div>
          </div>
          <div>
            <div className="estimate-widget__label">Weight</div>
            <div className="estimate-widget__value">{fmtKg(data.totalWeight)}</div>
          </div>
        </div>
        <div className="estimate-widget__tabs">
          <button
            type="button"
            className={`estimate-widget__tab${activeTab === 'estimate' ? ' active' : ''}`}
            onClick={() => setActiveTab('estimate')}
          >
            Estimate
          </button>
          <button
            type="button"
            className={`estimate-widget__tab${activeTab === 'ddp' ? ' active' : ''}`}
            onClick={() => setActiveTab('ddp')}
          >
            DDP
          </button>
        </div>
        <div className="estimate-widget__variant-head">
          <span>Variant</span>
          <span>Price</span>
          <span>Weight</span>
        </div>
        <div className="estimate-widget__variant-row">
          <span>V1 · 1.1</span>
          <span>{fmtEur(data.totalPrice)}</span>
          <span>{fmtKg(data.totalWeight)}</span>
        </div>
        <button type="button" className="estimate-widget__open" onClick={() => setOpen(true)}>
          ▶ Open Estimate
        </button>
      </div>

      <div className={`estimate-overlay${open ? ' open' : ''}`}>
        <div className="estimate-overlay__header">
          <div className="estimate-overlay__title">
            Estimate <span className="estimate-overlay__title-muted">— wizard prototype — [OPP-2026-0042]</span>
          </div>
          <select className="estimate-overlay__variant-selector" defaultValue="variant-1">
            <option value="variant-1">Variant 1 — V1 · 1.1</option>
          </select>
          <div className="estimate-overlay__status">Project status: QUOTE READY</div>
          <button type="button" className="estimate-overlay__close" onClick={() => setOpen(false)}>
            ✕ Close
          </button>
        </div>

        <div className="estimate-overlay__body">
          <div className="estimate-overlay__table-wrap">
            <div className="estimate-table-ui__major-head">
              <div className="estimate-table-ui__major-title">Structural</div>
              <button
                type="button"
                className={`estimate-overlay__details-toggle${compactView ? ' active' : ''}`}
                aria-pressed={compactView}
                title="Pressed = collapsed, released = expanded"
                onClick={() => setCompactView((v) => !v)}
              >
                Details
              </button>
            </div>
            <table className="estimate-table-ui">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Dimensions</th>
                  <th>Weight</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.frameGroups.map((group) => {
                  const isOpen = compactView ? false : (expanded[group.id] ?? true);
                  return (
                    <Fragment key={group.id}>
                      <tr key={`${group.id}-head`} className="estimate-table-ui__product" onClick={() => toggleGroup(group.id)}>
                        <td className="estimate-table-ui__product-name">
                          <span className="estimate-table-ui__chev">{isOpen ? '▾' : '▸'}</span>
                          {group.frameName}
                        </td>
                        <td>{group.frameLine.dimensions}</td>
                        <td>{fmtKg(group.subtotalWeight)}</td>
                        <td>1</td>
                        <td>{fmtEur(group.frameLine.unitPrice)}</td>
                        <td className="estimate-table-ui__price-total">{fmtEur(group.subtotalPrice)}</td>
                      </tr>
                      {isOpen && (
                        <>
                          <tr className="estimate-table-ui__section">
                            <td colSpan={6}>Structure base</td>
                          </tr>
                          <tr className="estimate-table-ui__article">
                            <td>{group.frameLine.name}</td>
                            <td>{group.frameLine.dimensions}</td>
                            <td>{fmtKg(group.frameLine.totalWeight)}</td>
                            <td>{group.frameLine.qty}</td>
                            <td>{fmtEur(group.frameLine.unitPrice)}</td>
                            <td>{fmtEur(group.frameLine.totalPrice)}</td>
                          </tr>
                          {group.mountedLines.length > 0 && (
                            <>
                              <tr className="estimate-table-ui__section">
                                <td colSpan={6}>Mounted on this frame</td>
                              </tr>
                              {group.mountedLines.map((row) => (
                                <tr className="estimate-table-ui__article" key={row.key}>
                                  <td>{row.name}</td>
                                  <td>{row.dimensions}</td>
                                  <td>{fmtKg(row.totalWeight)}</td>
                                  <td>{row.qty}</td>
                                  <td>{row.unitPrice > 0 ? fmtEur(row.unitPrice) : '—'}</td>
                                  <td>{row.totalPrice > 0 ? fmtEur(row.totalPrice) : '—'}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          {group.supportLines.length > 0 && (
                            <>
                              <tr className="estimate-table-ui__section">
                                <td colSpan={6}>Support accessories</td>
                              </tr>
                              {group.supportLines.map((row) => (
                                <tr className="estimate-table-ui__article" key={row.key}>
                                  <td>{row.name}</td>
                                  <td>{row.dimensions}</td>
                                  <td>{fmtKg(row.totalWeight)}</td>
                                  <td>{row.qty}</td>
                                  <td>{row.unitPrice > 0 ? fmtEur(row.unitPrice) : '—'}</td>
                                  <td>{row.totalPrice > 0 ? fmtEur(row.totalPrice) : '—'}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          <tr className="estimate-table-ui__subtotal">
                            <td colSpan={6}>Frame subtotal</td>
                            <td>{fmtEur(group.subtotalPrice)}</td>
                          </tr>
                        </>
                      )}
                    </Fragment>
                  );
                })}
                <tr className="estimate-table-ui__subtotal">
                  <td colSpan={6}>Structural subtotal</td>
                  <td>{fmtEur(data.structuralTotal)}</td>
                </tr>
              </tbody>
            </table>

            <div className="estimate-table-ui__major-title estimate-table-ui__major-title--secondary">Graphics</div>
            <table className="estimate-table-ui">
              <thead>
                <tr>
                  <th>Graphic panel</th>
                  <th>Panel size</th>
                  <th>Area</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.graphicsLines.length === 0 ? (
                  <tr className="estimate-table-ui__article">
                    <td colSpan={6}>No graphics selected yet.</td>
                  </tr>
                ) : (
                  data.graphicsLines.map((line) => {
                    const areaM2 = line.totalPrice / GRAPHICS_RATE_EUR_PER_M2;
                    return (
                      <tr className="estimate-table-ui__article" key={line.key}>
                        <td>{line.name}</td>
                        <td>{line.dimensions}</td>
                        <td>{fmtM2(areaM2)}</td>
                        <td>{line.qty}</td>
                        <td>{fmtEur(GRAPHICS_RATE_EUR_PER_M2)} / m2</td>
                        <td>{fmtEur(line.totalPrice)}</td>
                      </tr>
                    );
                  })
                )}
                <tr className="estimate-table-ui__subtotal">
                  <td colSpan={6}>Graphics subtotal ({fmtM2(data.graphicsAreaM2)})</td>
                  <td>{fmtEur(data.graphicsTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <aside className="estimate-overlay__summary">
            <div className="estimate-overlay__pane-title">Pricing tier</div>
            <div className="estimate-overlay__pane-strong">Gold</div>
            <div className="estimate-overlay__pane-title">Customer country</div>
            <div className="estimate-overlay__pane-strong">France · EUR</div>
            <div className="estimate-overlay__summary-row">
              <span>Structural</span>
              <strong>{fmtEur(data.structuralTotal)}</strong>
            </div>
            <div className="estimate-overlay__summary-row">
              <span>Graphics ({fmtM2(data.graphicsAreaM2)})</span>
              <strong>{fmtEur(data.graphicsTotal)}</strong>
            </div>
            <div className="estimate-overlay__summary-row">
              <span>Total</span>
              <strong>{fmtEur(data.totalPrice)}</strong>
            </div>
            <div className="estimate-overlay__summary-row">
              <span>Weight</span>
              <strong>{fmtKg(data.totalWeight)}</strong>
            </div>
            <div className="estimate-overlay__summary-row">
              <span>Products</span>
              <strong>{data.productsCount}</strong>
            </div>
            <div className="estimate-overlay__summary-row">
              <span>Graphics area</span>
              <strong>{fmtM2(data.graphicsAreaM2)}</strong>
            </div>
            <button type="button" className="estimate-overlay__btn-secondary">Download XLS</button>
            <button type="button" className="estimate-overlay__btn-primary">Checkout</button>
          </aside>
        </div>

        <div className="estimate-overlay__footer">
          <div className="estimate-overlay__footer-item">
            <div className="estimate-overlay__footer-label">Grand total</div>
            <div className="estimate-overlay__footer-value">{fmtEur(data.totalPrice)}</div>
          </div>
          <div className="estimate-overlay__footer-item">
            <div className="estimate-overlay__footer-label">Products</div>
            <div className="estimate-overlay__footer-value">{data.productsCount}</div>
          </div>
          <div className="estimate-overlay__footer-item">
            <div className="estimate-overlay__footer-label">Total price</div>
            <div className="estimate-overlay__footer-value">{fmtEur(data.totalPrice)}</div>
          </div>
          <div className="estimate-overlay__footer-item">
            <div className="estimate-overlay__footer-label">Weight</div>
            <div className="estimate-overlay__footer-value">{fmtKg(data.totalWeight)}</div>
          </div>
          <div className="estimate-overlay__footer-item">
            <div className="estimate-overlay__footer-label">Graphics area</div>
            <div className="estimate-overlay__footer-value">{fmtM2(data.graphicsAreaM2)}</div>
          </div>
        </div>
      </div>
    </>
  );
};

