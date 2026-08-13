// ensureRoutine.js — 오늘 루틴이 아직 없으면 자동 배정해 저장한다.
// Home(요약 카드)과 Exercise(운동 탭) 양쪽에서 같은 로직을 써야 하루 처음 여는
// 화면이 어디든 "오늘 할 것"이 바로 보인다.
import exercises from '../data/exercises.json'
import { assignRoutine } from './exerciseEngine.js'
import { getDay, setDay as dbSetDay, getAllExerciseMeta } from './db.js'
import { addDays } from './date.js'

export async function ensureTodayRoutine(profile, today, dayRow) {
  if (dayRow.routine.length > 0) return dayRow
  const [yesterday, meta] = await Promise.all([getDay(addDays(today, -1)), getAllExerciseMeta()])
  const { routine, mainBodyParts } = assignRoutine({
    exercises, profile, place: dayRow.exercisePlace, minutes: dayRow.exerciseMinutes,
    meta, yesterdayBodyParts: yesterday.routineBodyParts,
  })
  return dbSetDay(today, {
    routine: routine.map((e) => e.id), routineDone: [], routineBodyParts: mainBodyParts,
  })
}
