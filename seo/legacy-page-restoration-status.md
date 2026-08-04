# Legacy Page Restoration Status

Branch: `seo/legacy-page-restoration`

Status: Draft only. Not merged into `main` and not deployed to the production website.

Repository visibility note: the repository is public, so this branch can be viewed on GitHub even though it is not live at spraygenx.com.

## Restored draft pages

1. `flat-black-ceiling-spray/index.html`
   - Search intent: flat black open-deck ceiling painting
   - Original publication context recovered from indexed legacy material
   - Expanded with current Spray GenX field planning, coating, protection, and estimating content

2. `commercial-dryfall-ceiling-painting-dealership/index.html`
   - Search intent: dealership and automotive-facility dryfall ceiling painting
   - Original topic and publication context recovered from indexed legacy material
   - Expanded with dealership-specific protection, scheduling, bay access, vehicle, equipment, glass, and reopening considerations

3. `industrial-painting/dry-fall-painting/index.html`
   - Search intent: technical dry-fall painting guidance
   - Legacy category/topic recovered; complete original article was not available
   - Rebuilt transparently with Spray GenX field practice and manufacturer-published dryfall conditions and limitations

4. `spray-genx-industrial-painting/index.html`
   - Search intent: broad industrial painting contractor authority page
   - Substantial original scope and capability language recovered
   - Expanded into the parent page for ceilings, machinery, steel, masonry, floors, facility maintenance, and industrial refinishing

5. `industrial-spray/index.html`
   - Search intent: industrial spray painting and equipment refinishing
   - Substantial original preparation, protection, containment, application, and access content recovered
   - Expanded with modern scope definition, coating selection, project information, and internal linking

## Shared branch asset

- `legacy-authority.css`
  - Shared responsive design system for all five restored pages

## Draft safeguards

Every restored page currently includes:

- `noindex,follow`
- A self-referencing canonical URL for its intended future production address
- A visible banner stating that it is a private restoration draft and not published to production
- No meta-refresh redirect
- One primary H1
- Unique title and meta description
- Service and Article structured data
- Original Spray GenX project photography already present in the repository
- Internal links connecting the restored industrial content cluster

## Production protections

The following have not been changed on `main`:

- AWS Amplify redirects
- Sitemap
- Production navigation
- Live canonical tags
- Existing indexed pages

The production redirects should remain in place until each restored page is reviewed and approved for publication.

## Publication sequence

Recommended controlled release order:

1. Flat Black Ceiling Spray
2. Commercial Dryfall Ceiling Painting for Dealerships
3. Dry-Fall Painting
4. Spray GenX Industrial Painting
5. Industrial Spray Painting

For each approved page:

1. Remove the draft banner and `noindex` directive.
2. Verify the final canonical, structured data, image references, and internal links.
3. Remove only the redirect rules that conflict with that restored URL.
4. Add the URL to the sitemap.
5. Merge the approved page to `main`.
6. Confirm a live `200 OK` response.
7. Request indexing in Google Search Console.
