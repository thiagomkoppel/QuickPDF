export interface StandaloneEnvironment {
  readonly displayModeMatches: boolean;
  readonly navigatorStandalone: boolean;
}

export interface InstallPlatformEnvironment {
  readonly userAgent: string;
  readonly standalone: boolean;
  readonly maxTouchPoints: number;
}

interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

export const detectStandaloneMode = (environment: StandaloneEnvironment): boolean =>
  environment.displayModeMatches || environment.navigatorStandalone;

export const isStandaloneMode = (): boolean => {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return detectStandaloneMode({
    displayModeMatches: window.matchMedia("(display-mode: standalone)").matches,
    navigatorStandalone: navigatorWithStandalone.standalone === true,
  });
};

export const isIosSafari = (environment: InstallPlatformEnvironment): boolean => {
  if (environment.standalone) return false;
  const isIos =
    /iPad|iPhone|iPod/i.test(environment.userAgent) ||
    (/Macintosh/i.test(environment.userAgent) && environment.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(environment.userAgent);
  const isAlternativeIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(environment.userAgent);
  return isIos && isSafari && !isAlternativeIosBrowser;
};

export const currentInstallPlatform = (): InstallPlatformEnvironment => ({
  userAgent: navigator.userAgent,
  standalone: isStandaloneMode(),
  maxTouchPoints: navigator.maxTouchPoints,
});
