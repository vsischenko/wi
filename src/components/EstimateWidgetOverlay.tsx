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

const fmtEur = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const fmtKg = (value: number) => `${value.toFixed(1)} kg`;
const fmtM2 = (value: number) => `${value.toFixed(2)} m2`;

export const EstimateWidgetOverlay = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'estimate' | 'ddp'>('estimate');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);
  const boothLegCountOverride = useWizardStore((s) => s.boothLegCountOverride);
  const boothStabilizerCountOverride = useWizardStore((s) => s.boothStabilizerCountOverride);
  const boothLegFootKind = useWizardStore((s) => s.boothLegFootKind);

  const data = useMemo(() => {
    const qtyByProduct = new Map<string, number>();
    const structuralObjects = sceneObjects.filter((obj) => {
      const c = PRODUCT_BY_ID[obj.productId].category;
      return c === 'frame' || c === 'frame-counter' || c === 'arch';
    });
    sceneObjects.forEach((obj) => {
      qtyByProduct.set(obj.productId, (qtyByProduct.get(obj.productId) ?? 0) + 1);
    });

    const lines: Line[] = [...qtyByProduct.entries()].map(([productId, qty]) => {
      const p = PRODUCT_BY_ID[productId];
      const isAccessory = ['shelf', 'hangable'].includes(p.category);
      return {
        key: productId,
        name: p.name,
        dimensions: `${p.dimensions.width}×${p.dimensions.height}×${p.dimensions.depth} cm`,
        qty,
        unitPrice: p.priceEur,
        totalPrice: p.priceEur * qty,
        unitWeight: p.weightKg,
        totalWeight: p.weightKg * qty,
        kind: isAccessory ? 'accessories' : 'structure',
      };
    });

    const graphicsAreaM2 = Object.keys(frameGraphics).reduce((sum, objectId) => {
      const object = sceneObjects.find((obj) => obj.instanceId === objectId);
      if (!object) return sum;
      const surface = getGraphicSurfaceSizeCm(object.productId);
      return sum + (surface.width * surface.height) / 10000;
    }, 0);
    const graphicsPrice = graphicsAreaM2 * 35;
    if (graphicsAreaM2 > 0) {
      lines.push({
        key: 'graphics',
        name: `Graphics print (${graphicsAreaM2.toFixed(2)} m2)`,
        dimensions: '—',
        qty: 1,
        unitPrice: graphicsPrice,
        totalPrice: graphicsPrice,
        unitWeight: 0,
        totalWeight: 0,
        kind: 'graphics',
      });
    }

    const structureLines = lines.filter((l) => l.kind === 'structure');
    const accessoryLines = lines.filter((l) => l.kind === 'accessories');
    const graphicsLines = lines.filter((l) => l.kind === 'graphics');
    const totalPrice = lines.reduce((s, l) => s + l.totalPrice, 0);
    const totalWeight = lines.reduce((s, l) => s + l.totalWeight, 0);
    const structuralCount = countStructuralFramesForBooth(sceneObjects);
    const recLegs = recommendedLegCount(structuralCount);
    const recStabilizers = recommendedStabilizerCount(structuralCount);
    const effectiveLegs = boothLegCountOverride === null ? recLegs : Math.max(0, boothLegCountOverride);
    const effectiveStabilizers =
      boothStabilizerCountOverride === null ? recStabilizers : Math.max(0, boothStabilizerCountOverride);

    // Distribute feet/stabilizers per structural object then aggregate by product.
    const sortedStructural = structuralObjects
      .slice()
      .sort((a, b) => a.position[2] - b.position[2] || a.position[0] - b.position[0]);
    const byProductLegs = new Map<string, number>();
    const byProductStabilizers = new Map<string, number>();
    const n = sortedStructural.length;
    const legBase = n > 0 ? Math.floor(effectiveLegs / n) : 0;
    const legRem = n > 0 ? effectiveLegs % n : 0;
    const stBase = n > 0 ? Math.floor(effectiveStabilizers / n) : 0;
    const stRem = n > 0 ? effectiveStabilizers % n : 0;
    sortedStructural.forEach((obj, idx) => {
      byProductLegs.set(obj.productId, (byProductLegs.get(obj.productId) ?? 0) + legBase + (idx < legRem ? 1 : 0));
      byProductStabilizers.set(
        obj.productId,
        (byProductStabilizers.get(obj.productId) ?? 0) + stBase + (idx < stRem ? 1 : 0),
      );
    });

    return {
      structureLines,
      accessoryLines,
      graphicsLines,
      totalPrice,
      totalWeight,
      productsCount: sceneObjects.length,
      graphicsAreaM2,
      byProductLegs,
      byProductStabilizers,
      effectiveLegs,
      effectiveStabilizers,
      recLegs,
      recStabilizers,
    };
  }, [frameGraphics, sceneObjects, boothLegCountOverride, boothStabilizerCountOverride]);

  const productGroups = useMemo(() => {
    const groups = [...data.structureLines, ...data.accessoryLines, ...data.graphicsLines].map((line) => {
      const accessoryRows: Line[] = [];
      if (line.kind === 'structure') {
        const legs = data.byProductLegs.get(line.key) ?? 0;
        const st = data.byProductStabilizers.get(line.key) ?? 0;
        if (legs > 0) {
          accessoryRows.push({
            key: `${line.key}-legs`,
            name: `Legs (${boothLegFootKind})`,
            dimensions: '—',
            qty: legs,
            unitPrice: 0,
            totalPrice: 0,
            unitWeight: 0,
            totalWeight: 0,
            kind: 'accessories',
          });
        }
        if (st > 0) {
          accessoryRows.push({
            key: `${line.key}-st`,
            name: 'Frame stabilizer',
            dimensions: '—',
            qty: st,
            unitPrice: 0,
            totalPrice: 0,
            unitWeight: 0,
            totalWeight: 0,
            kind: 'accessories',
          });
        }
      }
      return {
        id: line.key,
        line,
        accessoryRows,
      };
    });
    return groups;
  }, [data, boothLegFootKind]);

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
            <table className="estimate-table-ui">
              <thead>
                <tr>
                  <th></th>
                  <th>Article</th>
                  <th>Dimensions</th>
                  <th>Weight</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {productGroups.map((group) => {
                  const isOpen = expanded[group.id] ?? true;
                  const sectionLabel =
                    group.line.kind === 'structure' ? 'Structure' : group.line.kind === 'accessories' ? 'Accessories' : 'Graphics';
                  return (
                    <Fragment key={group.id}>
                      <tr key={`${group.id}-head`} className="estimate-table-ui__product" onClick={() => toggleGroup(group.id)}>
                        <td className="estimate-table-ui__chev">{isOpen ? '▾' : '▸'}</td>
                        <td className="estimate-table-ui__product-name">{group.line.name}</td>
                        <td>{group.line.dimensions}</td>
                        <td>{fmtKg(group.line.totalWeight)}</td>
                        <td>{group.line.qty}</td>
                        <td>{fmtEur(group.line.unitPrice)}</td>
                        <td className="estimate-table-ui__price-total">{fmtEur(group.line.totalPrice)}</td>
                      </tr>
                      {isOpen && (
                        <>
                          <tr className="estimate-table-ui__section">
                            <td></td>
                            <td colSpan={6}>{sectionLabel}</td>
                          </tr>
                          <tr className="estimate-table-ui__article">
                            <td></td>
                            <td>{group.line.name}</td>
                            <td>{group.line.dimensions}</td>
                            <td>{fmtKg(group.line.totalWeight)}</td>
                            <td>{group.line.qty}</td>
                            <td>{fmtEur(group.line.unitPrice)}</td>
                            <td>{fmtEur(group.line.totalPrice)}</td>
                          </tr>
                          {group.accessoryRows.length > 0 && (
                            <>
                              <tr className="estimate-table-ui__section">
                                <td></td>
                                <td colSpan={6}>Accessories</td>
                              </tr>
                              {group.accessoryRows.map((row) => (
                                <tr className="estimate-table-ui__article" key={row.key}>
                                  <td></td>
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
                            <td colSpan={6}>Product subtotal</td>
                            <td>{fmtEur(group.line.totalPrice)}</td>
                          </tr>
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <aside className="estimate-overlay__summary">
            <div className="estimate-overlay__pane-title">Pricing tier</div>
            <div className="estimate-overlay__pane-strong">Gold</div>
            <div className="estimate-overlay__pane-title">Customer country</div>
            <div className="estimate-overlay__pane-strong">France · EUR</div>
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

