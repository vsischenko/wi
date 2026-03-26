import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { TopViewCanvas } from './scene/TopViewCanvas';
import { View3DCanvas } from './scene/View3DCanvas';

export const Layout = () => {
  return (
    <div className="app-shell">
      <Toolbar />
      <main className="workspace">
        <div className="viewports">
          <TopViewCanvas />
          <View3DCanvas />
        </div>
        <RightPanel />
      </main>
      <StatusBar />
    </div>
  );
};
