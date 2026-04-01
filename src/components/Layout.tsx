import { useState } from 'react';
import { ModelContextMenu } from './ModelContextMenu';
import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { TopViewCanvas } from './scene/TopViewCanvas';
import { View3DCanvas } from './scene/View3DCanvas';

export const Layout = () => {
  const [activeViewport, setActiveViewport] = useState<'3d' | '2d'>('3d');

  return (
    <div className="app-shell">
      <Toolbar />
      <main className="workspace">
        <div className="viewports">
          <div className="viewport-switcher">
            <button
              className={activeViewport === '3d' ? 'active' : ''}
              onClick={() => setActiveViewport('3d')}
            >
              3D View
            </button>
            <button
              className={activeViewport === '2d' ? 'active' : ''}
              onClick={() => setActiveViewport('2d')}
            >
              2D Top View
            </button>
          </div>
          {activeViewport === '3d' ? <View3DCanvas /> : <TopViewCanvas />}
        </div>
        <RightPanel />
      </main>
      <StatusBar />
      <ModelContextMenu />
    </div>
  );
};
