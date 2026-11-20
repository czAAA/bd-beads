import { MORE_TOUR_SIZES, playWholeTours } from '../../testUtils/ghostTour'

// The whole tour at more sizes, only with `VITE_GHOST_TOURS=all`: CI plays the desk and the large screen alone.
playWholeTours(MORE_TOUR_SIZES, import.meta.env.VITE_GHOST_TOURS === 'all')
