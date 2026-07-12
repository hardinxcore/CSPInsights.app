import type { ApplicationInsights } from '@microsoft/applicationinsights-web';

/**
 * Privacy-friendly, anonymous usage analytics via Azure Application Insights.
 *
 * Deliberate constraints:
 * - Cookieless (disableCookiesUsage): no persistent identifiers, no consent
 *   banner needed. Visits are counted per page load, not per tracked user.
 * - Respects Do Not Track and Global Privacy Control: the SDK is never even
 *   downloaded when either is enabled.
 * - Only runs in production builds.
 * - Collects: anonymous page views (with referrer for traffic origin) and
 *   which module (view) is opened. Azure derives country from the IP at
 *   ingestion and then discards the IP (default IP masking).
 * - Never collects: billing data, file contents, customer names or anything
 *   the user loads into the app. All business data stays local.
 *
 * The connection string is not a secret: it only allows sending telemetry
 * and is public in the client bundle by design.
 */
const CONNECTION_STRING =
    'InstrumentationKey=04f12d73-b1d9-461b-aab6-4b627663bcc5;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/;LiveEndpoint=https://westeurope.livediagnostics.monitor.azure.com/;ApplicationId=ffe1f95c-806f-478e-9afa-c4e2c62d13c2';

const userOptedOut = (): boolean => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
};

let appInsights: ApplicationInsights | null = null;
let pendingModules: string[] = [];

export const initAnalytics = async (): Promise<void> => {
    if (appInsights || !import.meta.env.PROD || userOptedOut()) return;

    try {
        const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
        const instance = new ApplicationInsights({
            config: {
                connectionString: CONNECTION_STRING,
                disableCookiesUsage: true,
                enableAutoRouteTracking: false,
                disableAjaxTracking: true,
                disableFetchTracking: true,
                autoTrackPageVisitTime: false,
                enableUnhandledPromiseRejectionTracking: false,
            },
        });
        instance.loadAppInsights();
        instance.trackPageView();
        appInsights = instance;

        // Flush module views recorded while the SDK was still loading
        pendingModules.forEach((module) => trackModuleView(module));
        pendingModules = [];
    } catch (err) {
        // Analytics must never break the app (e.g. blocked by an ad blocker)
        console.debug('Analytics disabled:', err);
    }
};

export const trackException = (error: Error): void => {
    if (!import.meta.env.PROD || userOptedOut() || !appInsights) return;
    appInsights.trackException({ exception: error });
};

export const trackModuleView = (module: string): void => {
    if (!import.meta.env.PROD || userOptedOut()) return;
    if (!appInsights) {
        if (pendingModules.length < 20) pendingModules.push(module);
        return;
    }
    appInsights.trackEvent({ name: 'moduleView', properties: { module } });
};
