/**
 * DivineShell.tsx
 * 
 * Shared 2Dlive shell components for the Divine Heroes app.
 * UI-only - no auth, navigation, or gameplay logic.
 * 
 * Components:
 * - CenteredBackground: Math-based perfect centering for background art
 * - DivineOverlays: Premium overlay effects (vignette, rays, grain)
 * - SanctumAtmosphere: Violet wash + bottom fade for Sanctum environment
 * - GlassCard: Divine glass + gold stroke card wrapper
 */

import React, { useEffect, useMemo, useState } from "react";
import { 
  Image, 
  ImageResolvedAssetSource, 
  ImageSourcePropType, 
  useWindowDimensions, 
  View 
} from "react-native";

type CenterFitMode = "contain" | "native";

/**
 * CenteredBackground - Hardened version with no-jump, truly deterministic centering
 * Works with both local require() and remote { uri } sources
 * Prevents the "flash/jump" on remote URLs by waiting for intrinsic size
 */
export function CenteredBackground(props: {
  source: ImageSourcePropType; // require() or {uri}
  mode?: CenterFitMode;        // default: contain
  zoom?: number;               // default: 1
  opacity?: number;            // default: 1
  waitForSize?: boolean;       // default: true - prevents "1x1 then jump" on remote URIs
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const mode = props.mode ?? "contain";
  const zoom = props.zoom ?? 1;
  const opacity = props.opacity ?? 1;
  const waitForSize = props.waitForSize ?? true;

  const resolvedLocal: ImageResolvedAssetSource | undefined = useMemo(() => {
    try {
      return Image.resolveAssetSource(props.source as any);
    } catch {
      return undefined;
    }
  }, [props.source]);

  const uri = (props.source as any)?.uri as string | undefined;
  const [remoteSize, setRemoteSize] = useState<{ w: number; h: number } | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let alive = true;

    // Local require: size known immediately.
    if (!uri) {
      setRemoteSize(null);
      setRemoteReady(true);
      return;
    }

    setRemoteReady(false);
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        setRemoteSize({ w, h });
        setRemoteReady(true);
      },
      () => {
        if (!alive) return;
        // If remote size fails, mark ready but keep size null (we'll fallback)
        setRemoteSize(null);
        setRemoteReady(true);
      }
    );

    return () => {
      alive = false;
    };
  }, [uri]);

  // If remote and we want to prevent a "jump", wait until we know it's ready.
  if (uri && waitForSize && !remoteReady) return null;

  const imgW = resolvedLocal?.width ?? remoteSize?.w ?? screenW;
  const imgH = resolvedLocal?.height ?? remoteSize?.h ?? screenH;

  let scale = 1;
  if (mode === "contain") {
    const sx = screenW / imgW;
    const sy = screenH / imgH;
    scale = Math.min(sx, sy) * zoom;
  } else {
    scale = zoom;
  }

  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = (screenW - scaledW) / 2;
  const top = (screenH - scaledH) / 2;

  return (
    <Image
      source={props.source}
      style={{
        position: "absolute",
        width: scaledW,
        height: scaledH,
        left,
        top,
        opacity,
      }}
      resizeMode="stretch"
    />
  );
}

/**
 * DivineOverlays - Premium overlay effects for celestial gacha aesthetic
 */
export function DivineOverlays(props: { vignette?: boolean; rays?: boolean; grain?: boolean }) {
  return (
    <>
      {props.rays ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            right: -120,
            bottom: -120,
            transform: [{ rotate: "-12deg" }],
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ) : null}

      {props.vignette ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.28)",
          }}
        />
      ) : null}

      {props.grain ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.02)",
          }}
        />
      ) : null}
    </>
  );
}

/**
 * SanctumAtmosphere - Adds depth and readability to Sanctum environment
 * - Cool violet wash for deeper feel
 * - Bottom fade for UI density/readability
 */
export function SanctumAtmosphere() {
  return (
    <>
      {/* Cool violet wash */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(20, 18, 40, 0.18)",
        }}
      />

      {/* Bottom fade for UI density */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 240,
          backgroundColor: "rgba(0,0,0,0.22)",
        }}
      />
    </>
  );
}

/**
 * SummonAtmosphere - Lighter wash for dramatic summon stage art
 * - Lighter violet so art stays punchy
 * - Stronger bottom fade for dense buttons
 */
export function SummonAtmosphere() {
  return (
    <>
      {/* Lighter wash so art stays punchy */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(20, 18, 40, 0.10)",
        }}
      />

      {/* Stronger bottom fade for dense buttons */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 280,
          backgroundColor: "rgba(0,0,0,0.26)",
        }}
      />
    </>
  );
}

/**
 * GlassCard - Divine glass + gold stroke card wrapper
 * Use to wrap any content for unified celestial styling
 */
export function GlassCard(props: { children: React.ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          padding: 1.2,
          backgroundColor: "rgba(255, 215, 140, 0.28)",
          shadowOpacity: 0.35,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        },
        props.style,
      ]}
    >
      <View
        style={{
          borderRadius: 21,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "rgba(10, 12, 18, 0.72)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
        }}
      >
        {props.children}
      </View>
    </View>
  );
}
