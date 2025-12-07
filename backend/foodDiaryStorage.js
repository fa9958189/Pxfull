import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "foodDiary.json");

const ensureFile = async () => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(dataFile);
  } catch (err) {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), "utf-8");
  }
};

const readAll = async () => {
  await ensureFile();
  const raw = await fs.readFile(dataFile, "utf-8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Erro ao parsear foodDiary.json, recriando.", err);
    return {};
  }
};

const writeAll = async (data) => {
  await ensureFile();
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf-8");
};

export const getFoodDiaryState = async (userId) => {
  const all = await readAll();
  const state = all[userId] || {};

  return {
    entriesByDate: state.entriesByDate || {},
    goals: state.goals || {},
    body: state.body || {},
    weightHistory: state.weightHistory || [],
  };
};

export const saveFoodDiaryState = async (userId, state) => {
  const all = await readAll();

  all[userId] = {
    entriesByDate: state.entriesByDate || {},
    goals: state.goals || {},
    body: state.body || {},
    weightHistory: state.weightHistory || [],
  };

  await writeAll(all);
  return all[userId];
};
