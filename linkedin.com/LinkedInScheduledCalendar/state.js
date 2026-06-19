export const state = {
  scheduledPostsByDate: new Map(),
  rawPosts: [],
  currentDate: new Date(),
  calendarButton: null,
  calendarView: null,
  originalScaffold: null,
};

export function resetCalendarState() {
  state.calendarView = null;
  state.originalScaffold = null;
}
