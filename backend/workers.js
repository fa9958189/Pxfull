import "dotenv/config";
import {
  startEventReminderWorker,
  startDailyRemindersWorker,
  startDailyWorkoutScheduleWorker,
} from "./reminders.js";

console.log("🟢 Workers iniciados");

startEventReminderWorker();
startDailyWorkoutScheduleWorker();
startDailyRemindersWorker();
