import { useMemo, useState } from 'react';
import { PRODUCT_BY_ID } from '../data/products';
import { useWizardStore } from '../store/useWizardStore';
import { getGraphicSurfaceSizeCm } from '../utils/graphics';

type Line = {
  key: string;
  name: string;
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

export const EstimateWidgetOverlay = () => {
  const [open, setOpen] = useState(false);
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const frameGraphics = useWizardStore((s) => s.frameGraphics);

  const data = useMemo(() => {
    const qtyByProduct = sceneObjects.reduce<Record<string, number>>((acc, obj) => {
      acc[obj.productId] = (acc[obj.productId] ?? 0) + 1;
      return acc;
    }, {});

    const lines: Line[] = Object.entries(qtyByProduct).map(([productId, qty]) => {
      const p = PRODUCT_BY_ID[productId];
      const isAccessory = ['shelf', 'hangable'].includes(p.category);
      return {
        key: productId,
        name: p.name,
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

    return {
      structureLines,
      accessoryLines,
      graphicsLines,
      totalPrice,
      totalWeight,
      productsCount: sceneObjects.length,
      graphicsAreaM2,
    };
  }, [frameGraphics, sceneObjects]);

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
        <div className="estimate-widget__meta">Variant 1 · Products: {data.productsCount}</div>
        <button type="button" className="estimate-widget__open" onClick={() => setOpen(true)}>
          Open Estimate
        </button>
      </div>

      <div className={`estimate-overlay${open ? ' open' : ''}`}>
        <div className="estimate-overlay__header">
          <div className="estimate-overlay__title">Estimate</div>
          <div className="estimate-overlay__variant">Variant 1</div>
          <button type="button" className="estimate-overlay__close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <div className="estimate-overlay__body">
          <div className="estimate-overlay__table-wrap">
            <table className="estimate-table-ui">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Qty</th>
                  <th>Weight</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="estimate-table-ui__section">
                  <td colSpan={5}>Structure</td>
                </tr>
                {data.structureLines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.name}</td>
                    <td>{line.qty}</td>
                    <td>{fmtKg(line.totalWeight)}</td>
                    <td>{fmtEur(line.unitPrice)}</td>
                    <td>{fmtEur(line.totalPrice)}</td>
                  </tr>
                ))}

                <tr className="estimate-table-ui__section">
                  <td colSpan={5}>Accessories</td>
                </tr>
                {data.accessoryLines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.name}</td>
                    <td>{line.qty}</td>
                    <td>{fmtKg(line.totalWeight)}</td>
                    <td>{fmtEur(line.unitPrice)}</td>
                    <td>{fmtEur(line.totalPrice)}</td>
                  </tr>
                ))}

                {data.graphicsLines.length > 0 && (
                  <>
                    <tr className="estimate-table-ui__section">
                      <td colSpan={5}>Graphics</td>
                    </tr>
                    {data.graphicsLines.map((line) => (
                      <tr key={line.key}>
                        <td>{line.name}</td>
                        <td>{line.qty}</td>
                        <td>{fmtKg(line.totalWeight)}</td>
                        <td>{fmtEur(line.unitPrice)}</td>
                        <td>{fmtEur(line.totalPrice)}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <aside className="estimate-overlay__summary">
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
              <strong>{data.graphicsAreaM2.toFixed(2)} m2</strong>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};

