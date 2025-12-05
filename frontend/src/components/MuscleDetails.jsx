import React from "react";

const MuscleDetails = ({ muscleKey }) => {
  let exercises = [];
  let folder = "";

  // PEITO
  if (muscleKey === "peito") {
    folder = "peito";
    exercises = [
      { name: "Crossover com pegada alta", file: "Crossover com pegada alta.gif" },
      { name: "Supino inclinado com halteres", file: "Supino inclinado com halteres.gif" },
      { name: "Supino reto com barra", file: "Supino reto com barra.gif" },
      { name: "Voador ou peck deck", file: "Voador ou peck deck.gif" },
    ];
  }

  // COSTAS
  if (muscleKey === "costas") {
    folder = "costas";
    exercises = [
      { name: "Pulley costas", file: "Pulley costas.gif" },
      { name: "Remada baixa", file: "Remada baixa.gif" },
      { name: "Remada serrote", file: "Remada serrote.gif" },
      { name: "Voador invertido", file: "Voador invertido.gif" },
    ];
  }

  // OMBROS
  if (muscleKey === "ombros") {
    // pasta está como "ombro" (singular)
    folder = "ombro";
    exercises = [
      { name: "Arnold press", file: "Arnold press.gif" },
      { name: "Crucifixo inverso", file: "Crucifixo inverso.gif" },
      { name: "Elevação frontal", file: "Elevação frontal.gif" },
      { name: "Elevação lateral", file: "Elevação lateral.gif" },
    ];
  }

  // BÍCEPS
  if (muscleKey === "biceps") {
    folder = "biceps";
    exercises = [
      { name: "Bíceps", file: "bíceps.gif" },
      { name: "Rosca concentrada", file: "Rosca concentrada.gif" },
      { name: "Rosca inclinada", file: "Rosca inclinada.gif" },
      { name: "Rosca martelo", file: "Rosca martelo.gif" },
      { name: "Rosca Scott", file: "Rosca Scott.gif" },
    ];
  }

  // Se não tiver exercícios configurados para o muscleKey atual, não renderiza nada
  if (!folder || exercises.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      {exercises.map((ex, index) => (
        <div key={index} style={{ marginBottom: "30px" }}>
          <h3 style={{ marginBottom: "10px" }}>{ex.name}</h3>
          <img
            src={`/src/assets/exercise/${folder}/${ex.file}`}
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
  );
};

export default MuscleDetails;
