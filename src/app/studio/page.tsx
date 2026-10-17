"use client";

import { CameraStage } from "@/components/studio/camera-stage";
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
        onEnableCamera={() => void session.enableCamera()}
        onDisableCamera={session.disableCamera}
        onTryExample={() => session.tryGarment(SAMPLE_GARMENT_URL)}
        onTryAgain={session.tryAgain}
        onDismissRecap={session.dismissRecap}
        onRemoteFrame={session.notifyRemoteFrame}
      />
      <aside className="flex min-h-0 items-center justify-center border-l border-border bg-v-canvas p-s-8">
        <div className="max-w-sm text-center">
          <p className="text-v-title font-weight-v-semibold">
            The rack is coming
          </p>
          <p className="mt-s-1 text-v-small text-muted-foreground">
            Live garments from Flipkart and Myntra land here in the next step.
            For now, try the example piece on the left.
          </p>
        </div>
      </aside>
    </main>
  );
}
