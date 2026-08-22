# Tenant-Scoped Projection Validation

**Environment:** DEV local static Web server on `http://127.0.0.1:4173`.

The default console was opened without a Family Bearer session. It showed the explicit development-preview boundary and `—` for family assets, member benefits, and service records; it did not render synthetic commercial, service, or membership metrics as if they were real data.

A clearly labelled synthetic DEV projection was then injected through the console's `initialProjection` seam to verify the successful read-model rendering path. The view rendered the tenant-scoped success notice, showed one family asset, and disabled the tenant selector. This confirms that a real session-bound response is treated as the authorization source and that the previous front-end preview tenant selector cannot override it.

No payment, refund, external booking, notification, share, or export action was invoked during this validation.
