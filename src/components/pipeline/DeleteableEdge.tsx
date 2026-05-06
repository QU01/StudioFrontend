"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

export function DeleteableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const deleteEdge = () => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
  };

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "#00f0ff" : "#007bff",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "6 3",
          animation: "dashdraw 0.5s linear infinite",
          filter: selected ? "drop-shadow(0 0 4px #007bff)" : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button
            onClick={deleteEdge}
            title="Delete connection"
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: selected ? "#ef4444" : "#1e293b",
              border: `1.5px solid ${selected ? "#ef4444" : "rgba(0,123,255,0.4)"}`,
              color: selected ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              transition: "all 0.15s ease",
              opacity: selected ? 1 : 0,
            }}
            className="edge-delete-btn"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
