import { useDevicePreferences } from '../../services/devicePreferences'

/**
 * The unit the Pattern size is stated in, beads or mm (ticket 342): kept on this device and shared by the Frame section
 * and Convert image's size step, so choosing it in one is choosing it in the other. Never saved with a Project.
 */
export function useSizeUnit() {
  return useDevicePreferences().get('sizeUnit')
}
