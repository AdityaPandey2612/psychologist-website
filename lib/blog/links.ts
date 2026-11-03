/** Links to the bare domain (or plain http) go straight to the preferred https://www address, with no redirect on the way. */
export function useWwwLinks(html: string): string {
  return html.replace(/(href=["'])https?:\/\/(?:www\.)?chaitanyaraj\.com(?=[\/"'?#])/gi, "$1https://www.chaitanyaraj.com");
}
