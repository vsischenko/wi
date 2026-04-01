import { useEffect, useMemo, useRef, useState } from 'react';
import { PRODUCT_BY_ID } from '../../data/products';
import { useWizardStore } from '../../store/useWizardStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const isGraphicSurfaceProduct = (productId: string) => {
  const product = PRODUCT_BY_ID[productId];
  if (!product) return false;
  return !!product.accentColor || product.category === 'arch';
};
const MAX_SURFACES = 10;

interface Segment {
  frameId: string;
  start: number;
  end: number;
  yMin: number;
  yMax: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getSurfaceSize = (productId: string) => {
  const product = PRODUCT_BY_ID[productId];
  if (product.category === 'arch') {
    const frame96 = PRODUCT_BY_ID['frame-96'];
    return {
      width: frame96.dimensions.width * 0.9,
      height: frame96.dimensions.height * 0.9,
    };
  }
  return {
    width: product.dimensions.width * 0.9,
    height: product.dimensions.height * 0.9,
  };
};

export const GraphicsEditorModal = ({ open, onClose }: Props) => {
  const sceneObjects = useWizardStore((s) => s.sceneObjects);
  const selectedFrameIds = useWizardStore((s) => s.selectedGraphicFrameIds);
  const applyGraphicToFrames = useWizardStore((s) => s.applyGraphicToFrames);
  const clearGraphicFrameSelection = useWizardStore((s) => s.clearGraphicFrameSelection);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const printableFrames = useMemo(
    () =>
      selectedFrameIds
        .map((id) =>
          sceneObjects.find((obj) => obj.instanceId === id && isGraphicSurfaceProduct(obj.productId)),
        )
        .filter((item): item is NonNullable<typeof item> => !!item)
        .slice(0, MAX_SURFACES),
    [sceneObjects, selectedFrameIds],
  );

  const layout = useMemo(() => {
    if (printableFrames.length === 0) return null;
    let cursor = 0;
    const segments: Segment[] = printableFrames.map((frame) => {
      const surface = getSurfaceSize(frame.productId);
      const segment = {
        frameId: frame.instanceId,
        start: cursor,
        end: cursor + surface.width,
        yMin: 0,
        yMax: surface.height,
      };
      cursor += surface.width;
      return segment;
    });

    const maxY = Math.max(...segments.map((segment) => segment.yMax));
    return {
      totalSpan: Math.max(1, cursor),
      totalHeight: Math.max(1, maxY),
      maxY,
      segments,
    };
  }, [printableFrames]);

  useEffect(() => {
    if (!open || !imageUrl) return;
    const image = new Image();
    image.onload = () => setImageElement(image);
    image.src = imageUrl;
  }, [open, imageUrl]);

  useEffect(() => {
    if (!open || !layout || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const pad = 24;
    const modelHeightCm = layout.totalHeight;
    const scale = Math.min((width - pad * 2) / layout.totalSpan, (height - pad * 2) / modelHeightCm);
    const modelW = layout.totalSpan * scale;
    const modelH = modelHeightCm * scale;
    const modelX = (width - modelW) / 2;
    const modelY = (height - modelH) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(modelX, modelY, modelW, modelH);

    if (imageElement) {
      const baseScale = Math.max(modelW / imageElement.width, modelH / imageElement.height);
      const drawW = imageElement.width * baseScale * zoom;
      const drawH = imageElement.height * baseScale * zoom;
      const imgX = modelX + (modelW - drawW) / 2 + pan.x;
      const imgY = modelY + (modelH - drawH) / 2 + pan.y;
      ctx.drawImage(imageElement, imgX, imgY, drawW, drawH);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1976d2';
    layout.segments.forEach((segment) => {
      const x = modelX + segment.start * scale;
      const w = Math.max(1, (segment.end - segment.start) * scale);
      const top = modelY + (layout.maxY - segment.yMax) * scale;
      const h = Math.max(1, (segment.yMax - segment.yMin) * scale);
      ctx.strokeRect(x, top, w, h);
    });
  }, [open, layout, imageElement, pan, zoom]);

  if (!open) return null;

  const onUploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageElement(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setZoom((value) => Math.max(0.2, Math.min(6, value * delta)));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY };
    setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  const applyImage = () => {
    if (!layout || !imageElement || !imageUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const pad = 24;
    const modelHeightCm = layout.totalHeight;
    const scale = Math.min((width - pad * 2) / layout.totalSpan, (height - pad * 2) / modelHeightCm);
    const modelW = layout.totalSpan * scale;
    const modelH = modelHeightCm * scale;
    const modelX = (width - modelW) / 2;
    const modelY = (height - modelH) / 2;

    const baseScale = Math.max(modelW / imageElement.width, modelH / imageElement.height);
    const drawW = imageElement.width * baseScale * zoom;
    const drawH = imageElement.height * baseScale * zoom;
    const imgX = modelX + (modelW - drawW) / 2 + pan.x;
    const imgY = modelY + (modelH - drawH) / 2 + pan.y;

    const assignments = layout.segments.map((segment) => {
      const x = modelX + segment.start * scale;
      const w = Math.max(1, (segment.end - segment.start) * scale);
      const top = modelY + (layout.maxY - segment.yMax) * scale;
      const h = Math.max(1, (segment.yMax - segment.yMin) * scale);
      const u0 = clamp01((x - imgX) / drawW);
      const u1 = clamp01((x + w - imgX) / drawW);
      const v0 = clamp01((top - imgY) / drawH);
      const v1 = clamp01((top + h - imgY) / drawH);
      return {
        frameId: segment.frameId,
        crop: { u0, v0, u1, v1 },
      };
    });

    applyGraphicToFrames(imageUrl, assignments);
    clearGraphicFrameSelection();
    onClose();
  };

  return (
    <div className="graphics-modal-backdrop" onClick={onClose}>
      <div className="graphics-modal" onClick={(event) => event.stopPropagation()}>
        <div className="graphics-modal-title">Step 3 - Apply Shared Graphic</div>
        {!layout ? (
          <div className="graphics-modal-warning">
            Select up to {MAX_SURFACES} advertising surfaces on scene. The editor keeps the click order.
          </div>
        ) : (
          <>
            <div className="graphics-modal-controls">
              <label className="graphics-upload-btn">
                Upload Image
                <input type="file" accept="image/*" onChange={onUploadImage} />
              </label>
              <button onClick={() => setZoom((value) => Math.max(0.2, value / 1.1))}>-</button>
              <button onClick={() => setZoom((value) => Math.min(6, value * 1.1))}>+</button>
              <button onClick={() => setPan({ x: 0, y: 0 })}>Reset Position</button>
            </div>
            <canvas
              ref={canvasRef}
              width={920}
              height={360}
              className="graphics-editor-canvas"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </>
        )}
        <div className="graphics-modal-actions">
          <button onClick={onClose}>Close</button>
          <button onClick={applyImage} disabled={!layout || !imageElement}>
            Apply to Selected Surfaces
          </button>
        </div>
      </div>
    </div>
  );
};
