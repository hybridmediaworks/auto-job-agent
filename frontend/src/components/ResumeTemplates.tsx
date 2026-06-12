/**
 * Barrel re-export for resume templates.
 *
 * The 8 template components and their shared helpers live under ./templates/.
 * This file preserves the original import surface so existing call sites
 * (`import { WaleedTemplate, RESUME_TEMPLATES, TemplateCard, ... } from '@/components/ResumeTemplates'`)
 * keep working without changes.
 */

export type { SiIcon, ToolEntry, TemplateProps } from './templates/shared'
export {
  PILL_COLORS,
  ensureUrl,
  cleanText,
  companyBgColor,
  resolveTools,
  ToolIconBox,
  PortfolioGrid,
  nonEmpty,
} from './templates/shared'

export {
  RESUME_TEMPLATES,
  TemplateSvgWaqar,
  TemplateSvgArham,
  TemplateSvgSheraz,
  TemplateSvgAdeel,
  TemplateSvgWaleedV2,
  TemplateSvgAdeelV2,
  TemplateSvg,
  TemplateCard,
} from './templates/previews'

export { WaleedTemplate } from './templates/WaleedTemplate'
export { RidaTemplate } from './templates/RidaTemplate'
export { ArhamTemplate } from './templates/ArhamTemplate'
export { SherazTemplate } from './templates/SherazTemplate'
export { WaqarTemplate } from './templates/WaqarTemplate'
export { AdeelTemplate } from './templates/AdeelTemplate'
export { WaleedV2Template } from './templates/WaleedV2Template'
export { AdeelV2Template } from './templates/AdeelV2Template'
