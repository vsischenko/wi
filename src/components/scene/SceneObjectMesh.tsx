import { Edges, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Fragment, useMemo, useRef } from 'react';
import { ClampToEdgeWrapping, Object3D, SRGBColorSpace } from 'three';
import type { Mesh } from 'three';
import { PRODUCT_BY_ID } from '../../data/products';
import { useWizardStore } from '../../store/useWizardStore';
import { LOCKED_OPACITY } from '../../utils/constants';
import type { SceneObject } from '../../types';

interface Props {
  object: SceneObject;
  selected: boolean;
  locked: boolean;
  onPointerDown: (event: any) => void;
  onPointerUp?: (event: any) => void;
  onContextMenu: (event: any) => void;
}

export const SceneObjectMesh = ({
  object,
  selected,
  locked,
  onPointerDown,
  onPointerUp,
  onContextMenu,
}: Props) => {
  const product = PRODUCT_BY_ID[object.productId];
  const isFrameCounter = product.category === 'frame-counter';
  const isShelf = product.category === 'shelf';
  const isHangable = product.category === 'hangable';
  const isMountedLight =
    !!object.attachedToFrameId &&
    (object.productId === 'light-led-strip-96' || object.productId === 'light-spot-mini');
  const isTvAnimated = ['tv-19', 'tv-96-16x9'].includes(object.productId);
  const isTvInstalled = isTvAnimated && !!object.attachedToFrameId;
  const tvMeshRef = useRef<Mesh>(null);
  const lightTargetRef = useRef<Object3D>(null);
  const lightSpotRef = useRef<import('three').SpotLight>(null);
  useFrame(({ clock }) => {
    if (isMountedLight && lightSpotRef.current && lightTargetRef.current) {
      lightSpotRef.current.target = lightTargetRef.current;
      lightSpotRef.current.target.updateMatrixWorld();
    }
    if (!isTvAnimated || !tvMeshRef.current) return;
    const m = tvMeshRef.current.material as import('three').MeshStandardMaterial;
    if (selected) {
      m.emissive.set('#26C6DA');
      m.emissiveIntensity = 0.22;
      return;
    }
    // When TV is installed on a frame, simulate a "playing" screen animation.
    // For non-installed TVs (if any), keep the emissive almost off.
    if (isTvInstalled) {
      const t = clock.elapsedTime;
      const wave = 0.5 + 0.5 * Math.sin(t * 6.2); // slow-ish flicker
      const flick = 0.5 + 0.5 * Math.sin(t * 18.0 + Math.sin(t * 2.1)); // sharper micro flicker
      const intensity = 0.08 + wave * 0.12 + flick * 0.05;
      m.emissive.set('#1565c0');
      m.emissiveIntensity = intensity;
    } else {
      m.emissive.set('#000000');
      m.emissiveIntensity = 0;
    }
  });
  const isCounterLike = ['counter', 'frame-counter'].includes(product.category);
  const isStorageLike = ['storage', 'closet'].includes(product.category);
  const isArch = product.category === 'arch';
  const opacity = locked ? LOCKED_OPACITY : 1;
  const frameGraphic = useWizardStore((s) => s.frameGraphics[object.instanceId]);
  const graphicUrl = useWizardStore((s) =>
    frameGraphic ? s.graphicsAssets[frameGraphic.assetId] : undefined,
  );
  const sourceTexture = useTexture(graphicUrl || '/icons.svg');
  const graphicTexture = useMemo(() => {
    if (!graphicUrl || !frameGraphic) return null;
    const tex = sourceTexture.clone();
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    const uSize = Math.max(0.001, frameGraphic.crop.u1 - frameGraphic.crop.u0);
    const vSize = Math.max(0.001, frameGraphic.crop.v1 - frameGraphic.crop.v0);
    // Crop is stored in canvas-top coordinates. Convert to texture UV space (bottom-origin).
    tex.repeat.set(uSize, vSize);
    tex.offset.set(frameGraphic.crop.u0, 1 - frameGraphic.crop.v1);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [frameGraphic, graphicUrl, sourceTexture]);
  const baseFrameProduct = PRODUCT_BY_ID['frame-96'];
  const topBarThickness = 4;
  const archTopY = baseFrameProduct.dimensions.height / 2 - topBarThickness / 2;
  const shelfColor = object.options?.shelfColor ?? 'white';
  const shelfColorHex =
    shelfColor === 'black' ? '#212121' : shelfColor === 'wood' ? '#8D6E63' : product.color;
  const countertopColor = object.options?.countertopColor ?? 'wood';
  const countertopColorHex =
    countertopColor === 'black' ? '#212121' : countertopColor === 'white' ? '#ECEFF1' : '#8D6E63';
  const hasCounterUsb = object.options?.countertopUsb ?? true;
  const hasStorageDoor = object.options?.storageHasDoor ?? true;
  const accentSurfaceOffset = 0.35;
  const lightBeamHeight = object.productId === 'light-led-strip-96' ? 115 : 95;
  const lightBeamRadius = object.productId === 'light-led-strip-96' ? 46 : 34;
  const spotAngle = object.productId === 'light-led-strip-96' ? 0.95 : 0.65;
  const spotIntensity = object.productId === 'light-led-strip-96' ? 1.25 : 1.1;
  const haloIntensity = object.productId === 'light-led-strip-96' ? 0.42 : 0.35;

  return (
    <group
      position={object.position}
      rotation={[0, object.rotation, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 0) onPointerDown(e);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        onContextMenu(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp?.(e);
      }}
    >
      {!isArch ? (
        <mesh ref={isTvAnimated ? tvMeshRef : undefined}>
          <boxGeometry args={[product.dimensions.width, product.dimensions.height, product.dimensions.depth]} />
          <meshStandardMaterial
            color={isShelf ? shelfColorHex : isHangable ? product.color : product.color}
            transparent
            opacity={opacity}
            emissive={selected ? '#26C6DA' : isTvAnimated ? '#1565c0' : '#000000'}
            emissiveIntensity={selected ? 0.22 : isTvAnimated ? 0.15 : 0}
          />
          {selected && <Edges color="#00E5FF" />}
        </mesh>
      ) : (
        <mesh>
          <boxGeometry
            args={[
              baseFrameProduct.dimensions.width,
              baseFrameProduct.dimensions.height,
              baseFrameProduct.dimensions.depth,
            ]}
          />
          <meshStandardMaterial transparent opacity={0} />
          {selected && <Edges color="#00E5FF" />}
        </mesh>
      )}

      {isArch && (
        <Fragment>
          {/* Standard vertical frame body */}
          <mesh>
            <boxGeometry
              args={[
                baseFrameProduct.dimensions.width,
                baseFrameProduct.dimensions.height,
                baseFrameProduct.dimensions.depth,
              ]}
            />
            <meshStandardMaterial color={baseFrameProduct.color} transparent opacity={opacity} />
          </mesh>
          <mesh
            position={[0, 0, baseFrameProduct.dimensions.depth / 2 + accentSurfaceOffset]}
            renderOrder={2}
          >
            <planeGeometry
              args={[baseFrameProduct.dimensions.width * 0.9, baseFrameProduct.dimensions.height * 0.9]}
            />
            {graphicTexture ? (
              <meshBasicMaterial
                color="#ffffff"
                map={graphicTexture}
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            ) : (
              <meshStandardMaterial
                color={baseFrameProduct.accentColor}
                transparent
                opacity={opacity}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            )}
          </mesh>
          {[-baseFrameProduct.dimensions.width / 3, 0, baseFrameProduct.dimensions.width / 3].map((x) => (
            <mesh key={x} position={[x, 0, baseFrameProduct.dimensions.depth / 2 + 0.4]}>
              <boxGeometry args={[0.7, baseFrameProduct.dimensions.height * 0.95, 0.7]} />
              <meshStandardMaterial color="#37474F" transparent opacity={opacity} />
            </mesh>
          ))}

          {/* Top horizontal frame extension (forms arch with another vertical frame) */}
          <mesh position={[0, archTopY, product.dimensions.depth]}>
            <boxGeometry args={[product.dimensions.width, topBarThickness, topBarThickness]} />
            <meshStandardMaterial color="#8E9AA1" transparent opacity={opacity} />
          </mesh>
          <mesh position={[0, archTopY, 0]}>
            <boxGeometry args={[product.dimensions.width, topBarThickness, topBarThickness]} />
            <meshStandardMaterial color="#8E9AA1" transparent opacity={opacity} />
          </mesh>
          <mesh position={[product.dimensions.width / 2, archTopY, product.dimensions.depth / 2]}>
            <boxGeometry args={[topBarThickness, topBarThickness, product.dimensions.depth]} />
            <meshStandardMaterial color="#8E9AA1" transparent opacity={opacity} />
          </mesh>
          <mesh position={[-product.dimensions.width / 2, archTopY, product.dimensions.depth / 2]}>
            <boxGeometry args={[topBarThickness, topBarThickness, product.dimensions.depth]} />
            <meshStandardMaterial color="#8E9AA1" transparent opacity={opacity} />
          </mesh>
        </Fragment>
      )}

      {product.accentColor && !isShelf && !isHangable && !isArch && (
        <mesh
          position={[0, 0, product.dimensions.depth / 2 + accentSurfaceOffset]}
          renderOrder={2}
        >
          <planeGeometry args={[product.dimensions.width * 0.9, product.dimensions.height * 0.9]} />
          {graphicTexture ? (
            <meshBasicMaterial
              color="#ffffff"
              map={graphicTexture}
              toneMapped={false}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          ) : (
            <meshStandardMaterial
              color={product.accentColor}
              transparent
              opacity={opacity}
              emissive={selected ? '#26C6DA' : '#000000'}
              emissiveIntensity={selected ? 0.18 : 0}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          )}
        </mesh>
      )}

      {isFrameCounter && (
        <group>
          <mesh position={[0, 100 - product.dimensions.height / 2, 18]}>
            <boxGeometry args={[96, 3, 40]} />
            <meshStandardMaterial color={countertopColorHex} transparent opacity={opacity} />
          </mesh>
          {hasCounterUsb && (
            <mesh position={[36, 100 - product.dimensions.height / 2 + 2.1, 2]}>
              <boxGeometry args={[6, 1.2, 3]} />
              <meshStandardMaterial color="#263238" transparent opacity={opacity} />
            </mesh>
          )}
        </group>
      )}

      {isCounterLike && !isFrameCounter && (
        <group>
          <mesh position={[0, product.dimensions.height / 2 - 1.5, 0]}>
            <boxGeometry args={[product.dimensions.width, 3, product.dimensions.depth]} />
            <meshStandardMaterial color={countertopColorHex} transparent opacity={opacity} />
          </mesh>
          {hasCounterUsb && (
            <mesh position={[product.dimensions.width / 2 - 8, product.dimensions.height / 2 + 0.6, 0]}>
              <boxGeometry args={[6, 1.2, 3]} />
              <meshStandardMaterial color="#263238" transparent opacity={opacity} />
            </mesh>
          )}
        </group>
      )}

      {isStorageLike && hasStorageDoor && (
        <mesh position={[0, 0, product.dimensions.depth / 2 + 0.8]}>
          <planeGeometry args={[product.dimensions.width * 0.6, product.dimensions.height * 0.75]} />
          <meshStandardMaterial color="#CFD8DC" transparent opacity={opacity * 0.95} />
        </mesh>
      )}

      {product.hasSupportBars && !isArch && (
        <Fragment>
          {[-product.dimensions.width / 3, 0, product.dimensions.width / 3].map((x) => (
            <mesh
              key={x}
              position={[
                x,
                0,
                product.dimensions.depth / 2 + 0.4,
              ]}
            >
              <boxGeometry args={[0.7, product.dimensions.height * 0.95, 0.7]} />
              <meshStandardMaterial color="#37474F" />
            </mesh>
          ))}
        </Fragment>
      )}

      {isMountedLight && (
        <group>
          <object3D ref={lightTargetRef} position={[0, -lightBeamHeight, 0]} />
          <spotLight
            ref={lightSpotRef}
            position={[0, -product.dimensions.height / 2 + 1, 0]}
            color="#FFF3C4"
            intensity={spotIntensity}
            angle={spotAngle}
            penumbra={0.75}
            distance={lightBeamHeight + 40}
            decay={2}
            castShadow={false}
          />
          <pointLight
            position={[0, -product.dimensions.height / 2, 0]}
            color="#FFE6A3"
            intensity={haloIntensity}
            distance={55}
            decay={2}
          />
          <mesh
            position={[0, -product.dimensions.height / 2 - lightBeamHeight * 0.46, 0]}
            rotation={[Math.PI, 0, 0]}
            raycast={() => null}
          >
            <coneGeometry args={[lightBeamRadius, lightBeamHeight, 26, 1, true]} />
            <meshBasicMaterial color="#FFF3BF" transparent opacity={0.14} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};
