/** GENERATED from design/tokens.json by design/build-tokens.mjs. Do not edit; change tokens.json and re-run. */

export const color = {
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#F7F8F6",
  gray100: "#EEF0EB",
  gray200: "#DCE0D6",
  gray300: "#B9C0B0",
  gray400: "#8A9480",
  gray600: "#5B6652",
  gray700: "#424B3B",
  gray800: "#2B3226",
  gray900: "#171C14",
  canvas: "#F6F8F3",
  green50: "#EBF5EC",
  green100: "#CFE8D2",
  green400: "#36A35E",
  green500: "#2F8F4E",
  green600: "#1F7A3F",
  green700: "#145C2F",
  amber50: "#FDF3E2",
  amber200: "#EFD9AE",
  amber500: "#C97F0A",
  amber700: "#8A5607",
  amber800: "#7A4C06",
  red50: "#FBEAEA",
  red500: "#C53A3A",
  red700: "#8E2525",
  blue50: "#E6F0F7",
  blue200: "#C9DDEB",
  blue500: "#2A6F9E",
  blue700: "#1C4E70",
  teal50: "#E1F3F2",
  teal200: "#BFE3E1",
  clay50: "#FBECE4",
  clay200: "#F0D2C3"
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999
} as const;

export const fontSize = {
  micro: 12,
  caption: 14,
  body: 16,
  label: 17,
  h2: 20,
  h1: 26,
  display: 30,
  hero: 54
} as const;

export const lineHeight = {
  micro: 16,
  caption: 20,
  body: 24,
  label: 24,
  h2: 32,
  h1: 40,
  display: 46,
  hero: 78
} as const;

/** What each colour is for (text, surfaces, buttons, status…), resolved to values. */

export const semanticColor = {
  text: {
    primary: "#171C14",
    secondary: "#424B3B",
    muted: "#5B6652",
    tertiary: "#8A9480",
    inverse: "#FFFFFF",
    inverseMuted: "#CFE8D2",
    link: "#145C2F",
    disabled: "#B9C0B0"
  },
  surface: {
    base: "#FFFFFF",
    canvas: "#F6F8F3",
    sunken: "#F7F8F6",
    raised: "#FFFFFF",
    brand: "#1F7A3F",
    brandDeep: "#145C2F",
    brandBright: "#36A35E",
    brandSoft: "#EBF5EC",
    brandMid: "#CFE8D2",
    overlay: "rgba(23, 28, 20, 0.5)",
    onBrandGlass: "rgba(255, 255, 255, 0.14)",
    onBrandLine: "rgba(255, 255, 255, 0.35)"
  },
  border: {
    default: "#DCE0D6",
    strong: "#B9C0B0",
    focus: "#1F7A3F",
    brand: "#CFE8D2"
  },
  interactive: {
    primaryBg: "#1F7A3F",
    primaryBgHover: "#145C2F",
    primaryBgPressed: "#145C2F",
    primaryLip: "#145C2F",
    primaryBgDisabled: "#DCE0D6",
    primaryText: "#FFFFFF",
    primaryTextDisabled: "#8A9480",
    secondaryBorder: "#CFE8D2",
    secondaryText: "#145C2F",
    softBg: "#EBF5EC",
    ghostText: "#145C2F"
  },
  status: {
    successText: "#145C2F",
    successBg: "#EBF5EC",
    warningText: "#7A4C06",
    warningBg: "#FDF3E2",
    warningBorder: "#EFD9AE",
    warningDot: "#C97F0A",
    dangerText: "#8E2525",
    dangerBg: "#FBEAEA",
    infoText: "#1C4E70",
    infoBg: "#E6F0F7"
  },
  tint: {
    leaf: {
      bg: "#EBF5EC",
      border: "#CFE8D2"
    },
    sky: {
      bg: "#E6F0F7",
      border: "#C9DDEB"
    },
    water: {
      bg: "#E1F3F2",
      border: "#BFE3E1"
    },
    sun: {
      bg: "#FDF3E2",
      border: "#EFD9AE"
    },
    clay: {
      bg: "#FBECE4",
      border: "#F0D2C3"
    },
    stone: {
      bg: "#EEF0EB",
      border: "#DCE0D6"
    }
  },
  priceUp: "#1F7A3F",
  priceDown: "#C53A3A"
} as const;
