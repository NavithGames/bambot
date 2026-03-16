"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { robotConfigMap } from "@/config/robotConfig";
import * as THREE from "three";
import { Html, useProgress } from "@react-three/drei";
import { ControlPanel } from "./keyboardControl/KeyboardControl";
import { useRobotControl } from "@/hooks/useRobotControl";
import { Canvas } from "@react-three/fiber";
import { ChatControl } from "./chatControl/ChatControl";
import LeaderControl from "../playground/leaderControl/LeaderControl";
import { useLeaderRobotControl } from "@/hooks/useLeaderRobotControl";
import { RobotScene } from "./RobotScene";
import KeyboardControlButton from "../playground/controlButtons/KeyboardControlButton";
import ChatControlButton from "../playground/controlButtons/ChatControlButton";
import LeaderControlButton from "../playground/controlButtons/LeaderControlButton";
import RecordButton from "./controlButtons/RecordButton";
import RecordControl from "./recordControl/RecordControl";
import {
  getPanelStateFromLocalStorage,
  setPanelStateToLocalStorage,
} from "@/lib/panelSettings";

export type JointDetails = {
  name: string;
  servoId: number;
  limit: {
    lower?: number;
    upper?: number;
  };
  jointType: "revolute" | "continuous";
};

type RobotLoaderProps = {
  robotName: string;
};

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center className="text-4xl text-white">
      {progress} % loaded
    </Html>
  );
}

export default function RobotLoader({ robotName }: RobotLoaderProps) {
  const [jointDetails, setJointDetails] = useState<JointDetails[]>([]);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showLeaderControl, setShowLeaderControl] = useState(false);
  const [showChatControl, setShowChatControl] = useState(false);
  const [showRecordControl, setShowRecordControl] = useState(false);
  const [showDatasetReplay, setShowDatasetReplay] = useState(false);
  const [dsData, setDsData] = useState<any>(null);
  const [dsEpisode, setDsEpisode] = useState(0);
  const [dsFrame, setDsFrame] = useState(0);
  const [dsPlaying, setDsPlaying] = useState(false);
  const dsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore panel states from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    const kb = getPanelStateFromLocalStorage("keyboardControl", robotName);
    setShowControlPanel(kb !== null ? kb : window.innerWidth >= 900);
    setShowLeaderControl(getPanelStateFromLocalStorage("leaderControl", robotName) ?? false);
    setShowChatControl(getPanelStateFromLocalStorage("chatControl", robotName) ?? false);
    setShowRecordControl(getPanelStateFromLocalStorage("recordControl", robotName) ?? false);
  }, [robotName]);
  const config = robotConfigMap[robotName];

  // Get leader robot servo IDs (exclude continuous joint types)
  const leaderServoIds = jointDetails
    .filter((j) => j.jointType !== "continuous")
    .map((j) => j.servoId);

  // Initialize leader robot control hook
  const leaderControl = useLeaderRobotControl(leaderServoIds);

  if (!config) {
    throw new Error(`Robot configuration for "${robotName}" not found.`);
  }

  const {
    urdfUrl,
    orbitTarget,
    camera,
    keyboardControlMap,
    compoundMovements,
    systemPrompt,
    urdfInitJointAngles,
  } = config;

  const {
    isConnected,
    connectRobot,
    disconnectRobot,
    jointStates,
    updateJointSpeed,
    setJointDetails: updateJointDetails,
    updateJointDegrees,
    updateJointsDegrees,
    updateJointsSpeed,
    isRecording,
    recordData,
    startRecording,
    stopRecording,
    clearRecordData,
  } = useRobotControl(jointDetails, urdfInitJointAngles);

  useEffect(() => {
    updateJointDetails(jointDetails);
  }, [jointDetails, updateJointDetails]);

  // Dataset replay: load data
  useEffect(() => {
    if (showDatasetReplay && !dsData) {
      fetch("/datasets/svla_so101_pickplace.json")
        .then((r) => r.json())
        .then((d) => setDsData(d))
        .catch(() => {});
    }
  }, [showDatasetReplay, dsData]);

  // Dataset replay: sync frame to 3D model
  const dsSyncFrame = useCallback((fi: number) => {
    if (!dsData) return;
    const ep = dsData.episodes?.[dsEpisode];
    if (!ep?.[fi]) return;
    const state: number[] = ep[fi].state;
    const revJoints = jointDetails.filter((j) => j.jointType === "revolute");
    updateJointsDegrees(
      revJoints.map((j, i) => ({ servoId: j.servoId, value: (state[i] ?? 0) + 180 }))
    );
  }, [dsData, dsEpisode, jointDetails, updateJointsDegrees]);

  // Dataset replay: play loop
  useEffect(() => {
    if (dsPlaying && dsData) {
      const ep = dsData.episodes?.[dsEpisode] || [];
      dsTimerRef.current = setInterval(() => {
        setDsFrame((prev) => {
          const next = prev + 1;
          if (next >= ep.length) { setDsPlaying(false); return prev; }
          dsSyncFrame(next);
          return next;
        });
      }, 1000 / 30);
    }
    return () => { if (dsTimerRef.current) clearInterval(dsTimerRef.current); };
  }, [dsPlaying, dsData, dsEpisode, dsSyncFrame]);

  // Functions to handle panel state changes and localStorage updates
  const toggleControlPanel = () => {
    setShowControlPanel((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("keyboardControl", newState, robotName);
      return newState;
    });
  };

  const toggleLeaderControl = () => {
    setShowLeaderControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("leaderControl", newState, robotName);
      return newState;
    });
  };

  const toggleChatControl = () => {
    setShowChatControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("chatControl", newState, robotName);
      return newState;
    });
  };

  const toggleRecordControl = () => {
    setShowRecordControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("recordControl", newState, robotName);
      return newState;
    });
  };

  const hideControlPanel = () => {
    setShowControlPanel(false);
    setPanelStateToLocalStorage("keyboardControl", false, robotName);
  };

  const hideLeaderControl = () => {
    setShowLeaderControl(false);
    setPanelStateToLocalStorage("leaderControl", false, robotName);
  };

  const hideChatControl = () => {
    setShowChatControl(false);
    setPanelStateToLocalStorage("chatControl", false, robotName);
  };

  const hideRecordControl = () => {
    setShowRecordControl(false);
    setPanelStateToLocalStorage("recordControl", false, robotName);
  };

  return (
    <>
      <Canvas
        shadows
        camera={{
          position: camera.position,
          fov: camera.fov,
        }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(0x263238);
        }}
      >
        <Suspense fallback={<Loader />}>
          <RobotScene
            robotName={robotName}
            urdfUrl={urdfUrl}
            orbitTarget={orbitTarget}
            setJointDetails={setJointDetails}
            jointStates={jointStates}
          />
        </Suspense>
      </Canvas>

      <ControlPanel
        show={showControlPanel}
        onHide={hideControlPanel}
        updateJointsSpeed={updateJointsSpeed}
        jointStates={jointStates}
        updateJointDegrees={updateJointDegrees}
        updateJointsDegrees={updateJointsDegrees}
        updateJointSpeed={updateJointSpeed}
        isConnected={isConnected}
        connectRobot={connectRobot}
        disconnectRobot={disconnectRobot}
        keyboardControlMap={keyboardControlMap}
        compoundMovements={compoundMovements}
      />
      <ChatControl
        show={showChatControl}
        onHide={hideChatControl}
        robotName={robotName}
        systemPrompt={systemPrompt}
      />
      {/* LeaderControl overlay */}
      <LeaderControl
        show={showLeaderControl}
        onHide={hideLeaderControl}
        leaderControl={leaderControl}
        jointDetails={jointDetails}
        onSync={(leaderAngles: { servoId: number; angle: number }[]) => {
          const revoluteJoints = jointDetails.filter(
            (j) => j.jointType === "revolute"
          );
          const revoluteServoIds = new Set(
            revoluteJoints.map((j) => j.servoId)
          );
          updateJointsDegrees(
            leaderAngles
              .filter((la) => revoluteServoIds.has(la.servoId))
              .map(
                ({ servoId, angle }: { servoId: number; angle: number }) => ({
                  servoId,
                  value: angle,
                })
              )
          );
        }}
      />

      {/* Dataset Replay Panel */}
      {showDatasetReplay && (
        <div className="absolute top-16 right-4 bg-black/85 backdrop-blur-sm rounded-lg p-4 text-white w-72 z-50 border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm text-cyan-400">Dataset Replay</span>
            <button onClick={() => { setShowDatasetReplay(false); setDsPlaying(false); }} className="text-gray-400 hover:text-white">✕</button>
          </div>
          {!dsData ? <div className="text-gray-400 text-sm">Loading...</div> : (() => {
            const ep = dsData.episodes?.[dsEpisode] || [];
            return <>
              <select value={dsEpisode} onChange={(e) => { setDsEpisode(+e.target.value); setDsFrame(0); setDsPlaying(false); }}
                className="w-full bg-gray-800 rounded px-2 py-1 text-sm mb-3">
                {Array.from({length: dsData.total_episodes}, (_, i) =>
                  <option key={i} value={i}>Episode {i} ({dsData.episodes[i]?.length} frames)</option>
                )}
              </select>
              <div className="flex gap-2 mb-3">
                <button onClick={() => { if (dsPlaying) setDsPlaying(false); else { setDsPlaying(true); if (dsFrame >= ep.length - 1) setDsFrame(0); }}}
                  className={`flex-1 py-1 rounded text-sm font-bold ${dsPlaying ? "bg-red-500" : "bg-cyan-500"}`}>
                  {dsPlaying ? "Pause" : "Play"}
                </button>
                <button onClick={() => { setDsPlaying(false); setDsFrame(0); dsSyncFrame(0); }}
                  className="px-3 py-1 rounded text-sm bg-gray-700">Reset</button>
              </div>
              <input type="range" min={0} max={Math.max(0, ep.length - 1)} value={dsFrame}
                onChange={(e) => { setDsPlaying(false); const f = +e.target.value; setDsFrame(f); dsSyncFrame(f); }}
                className="w-full mb-1" />
              <div className="text-xs text-gray-400 text-center mb-2">Frame {dsFrame} / {ep.length - 1}</div>
              {["shoulder_pan","shoulder_lift","elbow_flex","wrist_flex","wrist_roll","gripper"].map((name, i) => {
                const val = ep[dsFrame]?.state?.[i] ?? 0;
                const pct = Math.max(0, Math.min(100, ((val + 100) / 200) * 100));
                return <div key={name} className="flex items-center gap-2 mb-1">
                  <span className="text-xs w-20 text-gray-300 truncate">{name}</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded"><div className="h-full bg-cyan-400 rounded" style={{width:`${pct}%`}}/></div>
                  <span className="text-xs w-8 text-right text-gray-400">{val.toFixed(0)}</span>
                </div>;
              })}
              <div className="mt-2 text-xs text-gray-500 text-center">lerobot/svla_so101_pickplace</div>
            </>;
          })()}
        </div>
      )}

      {/* Record Control overlay */}
      <RecordControl
        show={showRecordControl}
        onHide={hideRecordControl}
        isRecording={isRecording}
        recordData={recordData}
        startRecording={startRecording}
        stopRecording={stopRecording}
        clearRecordData={clearRecordData}
        updateJointsDegrees={updateJointsDegrees}
        updateJointsSpeed={updateJointsSpeed}
        jointDetails={jointDetails}
        leaderControl={{
          isConnected: leaderControl.isConnected,
          disconnectLeader: leaderControl.disconnectLeader,
        }}
      />

      <div className="absolute bottom-5 left-0 right-0">
        <div className="flex justify-center items-center">
          <div className="flex gap-2 max-w-md">
            <LeaderControlButton
              showControlPanel={showLeaderControl}
              onToggleControlPanel={toggleLeaderControl}
            />
            <KeyboardControlButton
              showControlPanel={showControlPanel}
              onToggleControlPanel={toggleControlPanel}
            />
            <ChatControlButton
              showControlPanel={showChatControl}
              onToggleControlPanel={toggleChatControl}
            />
            <RecordButton
              showControlPanel={showRecordControl}
              onToggleControlPanel={toggleRecordControl}
            />
            <button
              onClick={() => setShowDatasetReplay((p) => !p)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showDatasetReplay ? "bg-cyan-500 text-white" : "bg-gray-800/80 text-gray-300 hover:bg-gray-700/80"
              }`}
            >Dataset</button>
          </div>
        </div>
      </div>
    </>
  );
}
