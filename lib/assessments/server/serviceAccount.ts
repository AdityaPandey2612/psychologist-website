// SECRET — Firebase Admin service-account key for project "chaitanyaraj-2a62a", kept in source on purpose
// so the deployed site works without extra Vercel settings.
//
// Only safe while this repository stays PRIVATE and only trusted people can read it.
// If the repository ever becomes public, or this file is shared, revoke the key first:
// Google Cloud console -> IAM & Admin -> Service accounts -> Keys -> delete this key, create a new one,
// and put the new one in the FIREBASE_SERVICE_ACCOUNT_JSON environment variable instead.
//
// The environment variables (FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_ADMIN_*) always take priority over this value.

export interface HardcodedServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export const HARDCODED_SERVICE_ACCOUNT: HardcodedServiceAccount | null = {
  "projectId": "chaitanyaraj-2a62a",
  "clientEmail": "firebase-adminsdk-fbsvc@chaitanyaraj-2a62a.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDVJdsM/hOQhkwP\nNuWamLdgtiE5QfBja34nF10jRGmd3542dKMF3vCTTLkWiHhT+GlmLAk6K9JOTJvm\n08sWvy6E3qgzoNeM9x39JcsFIjQxOw/xnaM8cobS0E/s+dLz/PUvvKRpJO0O2dxu\nhVcFnEzpfs0rk8oknUYmTVgak/vXmWHpURHLa2vxXQSZ8hnG0hve4BcV1iw7aVxI\njRmB/2LeSg5StMqk23SCmofZqCWcJuDLlzIv5HaGibzHM3UkvkQREwmZCPatzwYj\nFqNacS0FC8FCMPIbZ7jynK0yUA6otx6rwF8aAnzWeNie8agH26Nyx76obM84CprJ\nhKqpLChvAgMBAAECggEAAM08Ji/cdfozVglQUsUJR4lX1aXMWCti1ZXOaWAL/6aE\nK1ND+7UrdXpf5dhMj5BLITHANSJOD7JVEcixJlxAugo2Wr9boDGbwMSAH3xR8u90\nb2W24/bQUAGtk0gbRYSpjWzpt2WGqLwkCpxgx+ofFe++qM/M/ldDGMjIsIzm8Rgm\nVrTm4+pvO9bQwzHEHMySbtfuiIRBSy/4bm3IguVyyH92lJSp1z87uI8QffNf15gM\nK+q+v+nRI2yEXTyF0szVvyazWij6FIewEljJeAcrYgES8EELq1XfpW8ExsrCpIdN\nmSEaHK7w4yKY5YEdWpvokecPB4qp87bJnlssYrfnzQKBgQDtzkps+Zm5NXX/ASL0\nn+eYXp62ikpxXLg0LQwWv/iS66bXBmogsedP3dn6ug8QEUr+m/mR0K5f+y8eiE/z\nzat+jGEzD+f4Thd8euELwT8CVxhNLBIv/0IFid0cMb43s8vFHwK6ukoK5YIHa8oE\nw0/2f0gWgcOqBO1BhNLrMBnKawKBgQDldJwXxIAEfpPVS2iHvt7ZRK4IUqVfBNf6\nhCxulF9ryNcPybOjSqIhvmtWlZxqN177qsTq+3E7KZHhfMyYXzeXUVd7SfSbL6pz\nSuM4PrMJyP90yMP3MvNZxpCdJFxsNNiGRvNlPvORiaVCS4yF9NMmIyNMItM2dl7z\nV5qmJCDjDQKBgQCISC7S4QA96etjZo1Xz8PzyFYAmqQq704JaL+C0iVsXWxR0jVD\n43CCjst7KuGy/ZYS7+RIsmUcUGEiiE/5kqZzcZPKpZT08hv3lJwgFnE7sBoXL+iE\nZS666dUzcTZnybw/jZQM2vHP6NNp2VX/AMd0pmDztQ4jA4vMfog5jGlbXQKBgQCF\no6cOCLpu47ICdosJFNgCPwgFfO0oLFAGbljahrwUsMLhRR7FKkDH2nn10elpy5oc\nhddu7MeEJ6/5XpBi5oIgNZX4DpjSka56u9Ee/xWTy2dNg2jvXtNxJD8x5u2VcCnz\n+vrjqwh9aWfA9vN/SZp5CdoTC+1sOQEQRaOixEQLOQKBgG5tIloKuZpampcY9bfV\nO7niYqO8xyKHSOjB2TGeg9DAeh3274zZhe8ONOf1SRHNQp34pN5NxGf5lrfTqy6G\nq9I+D9B+s5qB7ZWxrzeOeaff1RnH3BTcD9EgTUqKmUIth3DIn8os0Xz4lyTHVa5H\nlxQIxtzzxlLE9a/6wjT6+AmN\n-----END PRIVATE KEY-----\n"
};

/** The embedded key, unless ASSESSMENT_IGNORE_EMBEDDED_KEY=1 is set (used by tests, or to run without it). */
export function embeddedServiceAccount(): HardcodedServiceAccount | null {
  return process.env.ASSESSMENT_IGNORE_EMBEDDED_KEY === "1" ? null : HARDCODED_SERVICE_ACCOUNT;
}
