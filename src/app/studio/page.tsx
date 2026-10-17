"use client";

import { CameraStage } from "@/components/studio/camera-stage";
import { StorePanel } from "@/components/studio/store-panel";
import { useTryOnSession } from "@/lib/decart/use-tryon-session";
import { SAMPLE_GARMENT_URL } from "@/lib/sample-garment";

export default function StudioPage() {
  const session = useTryOnSession();

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
      <CameraStage
        state={session.state}
        localStream={session.localStream}
        remoteStream={session.remoteStream}
        recapUrl={session.recapUrl}
        onEnableCamera={() => void session.enableCamera()}
        onDisableCamera={session.disableCamera}
        onTryExample={() => session.tryGarment(SAMPLE_GARMENT_URL)}
        onTryAgain={session.tryAgain}
        onDismissRecap={session.dismissRecap}
        onRemoteFrame={session.notifyRemoteFrame}
      />
      <StorePanel onTryOn={(url) => session.tryGarment(url)} />
    </main>
  );
}
