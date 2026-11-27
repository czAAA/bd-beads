import { computed } from 'vue'
import type { FrameId } from '../../domain/grid'
import { frameWeave } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import { describeWeave, weaveSettings } from '../../domain/weave'
import { weaveSettingWords } from '../../i18n/settingWords'
import { useI18n } from '../../i18n/useI18n'

/** A Frame's weave and the settings its Technique describes (ticket 0698), never named per Technique: each with its value
 * and, locked once a pass is done as a Drop moves the passes, its reason. For the margin sheet and the Frame popover. */
export function useFrameSettings(project: () => Project, frame: () => FrameId) {
  const { t } = useI18n()
  const weave = computed(() => frameWeave(project(), frame()))
  const locked = computed(() => rowProgressStarted(project(), frame()))
  const settings = computed(() => {
    const values = weaveSettings(weave.value)
    return describeWeave(weave.value).settings.map((setting) => ({
      setting,
      value: values[setting.id]!,
      disabledBody: locked.value ? weaveSettingWords(t.value, setting).locked : undefined,
    }))
  })
  return { weave, locked, settings }
}
