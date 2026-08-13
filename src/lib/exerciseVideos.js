import videosById from '../data/exercise-videos.json'

export function getVideosFor(exerciseId) {
  return videosById[exerciseId] || []
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
