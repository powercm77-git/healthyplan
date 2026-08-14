// libraryFilterState.js — 운동 찾기 화면의 필터·스크롤 상태를 컴포넌트 바깥(모듈
// 스코프)에 둔다. ExerciseLibrary는 상세로 들어갔다 나올 때는 물론, 운동 탭을 완전히
// 벗어났다가 돌아와도(부모 Exercise가 통째로 unmount) 이 객체를 그대로 다시 읽는다.
// 브라우저를 새로고침하면 초기화된다(요구사항은 "탭을 벗어났다 돌아와도"까지).
export const libraryFilterState = {
  query: '',
  place: null,
  bodyPart: null,
  equipment: null,
  level: null,
  ageGroup: null,
  videoOnly: false,
  scrollTop: 0,
}

export function resetLibraryFilters() {
  libraryFilterState.query = ''
  libraryFilterState.place = null
  libraryFilterState.bodyPart = null
  libraryFilterState.equipment = null
  libraryFilterState.level = null
  libraryFilterState.ageGroup = null
  libraryFilterState.videoOnly = false
  libraryFilterState.scrollTop = 0
}
