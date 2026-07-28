import { useSyncExternalStore } from "react";

import { Shell } from "../presentation/components/Shell";
import { EditorPage } from "../presentation/pages/EditorPage";
import { LandingPage } from "../presentation/pages/LandingPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";

const getPathname = (): string => window.location.pathname;

const subscribeToNavigation = (onStoreChange: () => void): (() => void) => {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("quickpdf:navigation", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("quickpdf:navigation", onStoreChange);
  };
};

const getServerPathname = (): string => "/";

const renderRoute = (pathname: string): React.ReactNode => {
  switch (pathname) {
    case "/":
      return <LandingPage />;
    case "/editor":
      return <EditorPage />;
    default:
      return <NotFoundPage />;
  }
};

export const App = (): React.ReactElement => {
  const pathname = useSyncExternalStore(subscribeToNavigation, getPathname, getServerPathname);

  return <Shell>{renderRoute(pathname)}</Shell>;
};
