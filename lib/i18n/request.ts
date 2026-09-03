import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  let locale = store.get(LOCALE_COOKIE)?.value as Locale | undefined;
  if (!locale || !locales.includes(locale)) {
    const accept = (await headers()).get("accept-language") ?? "";
    locale = accept.toLowerCase().startsWith("en") ? "en" : defaultLocale;
  }
  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone: "Asia/Seoul",
  };
});
