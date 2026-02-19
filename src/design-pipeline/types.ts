// AI-Native Design Pipeline Types — R20-03

export interface DesignPipelineConfig {
  enabled: boolean;
  defaultVariants: 1 | 2 | 3 | 5;
  maxScreensPerJourney: number;
  responsivePresets: ('mobile' | 'tablet' | 'desktop')[];
  visionModel: 'local-llava' | 'grok-vision' | 'perplexity-sonar-vision';
  tasteVaultInfluence: number; // 0-1
  autoDreamModePreview: boolean;
  maxTokensPerGeneration: number;
}

export interface DesignFlow {
  id: string;
  name: string;
  description: string;
  screens: ScreenSpec[];
  connections: ScreenConnection[];
  journeyType: 'auth' | 'onboarding' | 'core' | 'launch' | 'custom';
  semanticTags: string[];
  variantParentId?: string; // A/B tracking
}

export interface ScreenConnection {
  fromScreenId: string;
  toScreenId: string;
  trigger: string; // e.g., 'click:button-id', 'submit:form', 'swipe:left'
}

export interface ScreenSpec {
  id: string;
  name: string;
  layout: 'stack' | 'grid' | 'scroll' | 'modal';
  components: ComponentSpec[];
  designTokens: DesignToken[];
  responsiveBreakpoints: {
    mobile?: BreakpointConfig;
    tablet?: BreakpointConfig;
    desktop?: BreakpointConfig;
  };
  accessibility: {
    ariaLabels: Record<string, string>;
    contrastRatio: number;
  };
  dreamModeReady: boolean;
}

export interface BreakpointConfig {
  width: number;
  columns: number;
  spacing: string;
}

export interface ComponentSpec {
  id: string;
  type: 'button' | 'card' | 'swipeable' | 'chat' | 'gallery' | 'timeline' | 'custom';
  props: Record<string, unknown>;
  children?: ComponentSpec[];
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  animation?: AnimationConfig;
  tasteVaultTags: string[];
}

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'scale' | 'rotate';
  duration: number;
  delay?: number;
  easing: string;
}

export interface DesignToken {
  category: 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'motion';
  name: string;
  value: string | number | { light: string; dark: string };
  source: string;
  confidence: number; // 0-1
}

export interface DesignSystemConfig {
  tokens: DesignToken[];
  baseFont: string;
  colorPalette: string[];
  spacingScale: string[];
  motionCurve: string;
  derivedFromTasteVault: boolean;
}

export interface JourneyTemplate {
  id: string;
  name: string;
  type: DesignFlow['journeyType'];
  minScreens: number;
  maxScreens: number;
  requiredComponents: string[];
  recommendedPatterns: string[];
}

export interface ScreenshotAnalysis {
  sourceImage: string;
  detectedComponents: ComponentSpec[];
  colorPalette: string[];
  typography: {
    fonts: string[];
    sizes: number[];
  };
  layout: {
    type: ScreenSpec['layout'];
    gridColumns?: number;
  };
  confidence: number;
}

export interface VariantSet {
  parentId: string;
  variants: DesignFlow[];
  selectionMetric: 'engagement' | 'conversion' | 'a11y' | 'speed';
  winningVariantId?: string;
}

export interface ResponsiveOutput {
  screenId: string;
  breakpoints: {
    mobile: ScreenSpec;
    tablet?: ScreenSpec;
    desktop?: ScreenSpec;
  };
}

export interface LivingCanvasRender {
  flow: DesignFlow;
  interactive: boolean;
  previewUrl?: string;
  exportFormats: ('tsx' | 'html' | 'figma' | 'pdf')[];
}

export const DEFAULT_DESIGN_PIPELINE_CONFIG: DesignPipelineConfig = {
  enabled: true,
  defaultVariants: 3,
  maxScreensPerJourney: 10,
  responsivePresets: ['mobile', 'tablet', 'desktop'],
  visionModel: 'grok-vision',
  tasteVaultInfluence: 0.94,
  autoDreamModePreview: true,
  maxTokensPerGeneration: 4000,
};

export const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  {
    id: 'auth-login',
    name: 'Authentication - Login',
    type: 'auth',
    minScreens: 1,
    maxScreens: 3,
    requiredComponents: ['input', 'button', 'link'],
    recommendedPatterns: ['social-login', 'forgot-password'],
  },
  {
    id: 'auth-signup',
    name: 'Authentication - Signup',
    type: 'auth',
    minScreens: 1,
    maxScreens: 4,
    requiredComponents: ['input', 'button', 'checkbox'],
    recommendedPatterns: ['progressive-profiling', 'email-verification'],
  },
  {
    id: 'onboarding-welcome',
    name: 'Onboarding - Welcome',
    type: 'onboarding',
    minScreens: 3,
    maxScreens: 5,
    requiredComponents: ['swipeable', 'button', 'image'],
    recommendedPatterns: ['feature-carousel', 'permission-request'],
  },
  {
    id: 'core-dashboard',
    name: 'Core - Dashboard',
    type: 'core',
    minScreens: 1,
    maxScreens: 5,
    requiredComponents: ['card', 'chart', 'navigation'],
    recommendedPatterns: ['customizable-widgets', 'quick-actions'],
  },
  {
    id: 'launch-landing',
    name: 'Launch - Landing Page',
    type: 'launch',
    minScreens: 1,
    maxScreens: 2,
    requiredComponents: ['hero', 'cta', 'social-proof'],
    recommendedPatterns: ['value-proposition', 'trust-signals'],
  },
];
