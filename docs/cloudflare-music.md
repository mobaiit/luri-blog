# Music Provider deployment

The `luri-blog` repository contains the personal blog, LURI MUSIC player UI, account system, and generic Music Provider Protocol client only. It does not expose music search, random discovery, URL resolution, lyrics, artwork, or source-list endpoints.

Music capabilities are implemented by independent Provider projects selected and configured by the user. This repository does not bundle, recommend, or default to a particular Provider.

The browser obtains a short-lived Provider credential through `/api/luri-music/providers/{id}/token`, then calls the active Provider endpoints directly. Audio bytes are delivered from the URL returned by the Provider; the blog Worker does not proxy audio.

Provider implementations, upstream adapters, resolvers, and Provider administration belong in their respective Provider repositories. The protocol and interface reference presented to users is available at `/docs`.
