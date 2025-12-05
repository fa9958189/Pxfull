import React from "react";

const MuscleDetails = ({ muscleKey }) => {
  let exercises = [];

  if (muscleKey === "biceps") {
    exercises = [
      { name: "Bíceps", file: "bíceps.gif" },
      { name: "Rosca concentrada", file: "Rosca concentrada.gif" },
      { name: "Rosca inclinada", file: "Rosca inclinada.gif" },
      { name: "Rosca martelo", file: "Rosca martelo.gif" },
      { name: "Rosca Scott", file: "Rosca Scott.gif" },
    ];
  }

  return (
    <div>
      {exercises.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          {exercises.map((ex, index) => (
            <div key={index} style={{ marginBottom: "30px" }}>
              <h3 style={{ marginBottom: "10px" }}>{ex.name}</h3>
              <img
                src={`/src/assets/exercise/biceps/${ex.file}`}
                alt={ex.name}
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  height: "auto",
                  borderRadius: "10px",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MuscleDetails;
