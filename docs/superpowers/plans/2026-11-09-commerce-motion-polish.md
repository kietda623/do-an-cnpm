# Commerce motion and interaction polish

User requested stronger animation and a more polished UI/UX after approving the Shopee direction. Keep that direction, all current routes/handlers, readable filter sizing, and saved theme. Implement directly as a refinement of the approved system.

1. Add a focused shared commerce-motion.css after the existing composition imports. Use transform/opacity for finite entrances, restrained hover/press feedback, native-details menu entry, dialog entry and selected-navigation feedback. Never hide data controls, animate layout dimensions, or loop attention effects. Reduced motion disables the decorative layer.
2. Polish the existing welcome/category/filter surfaces and field focus hierarchy without changing data or introducing unsupported marketing claims. Preserve contrast and current responsive grid/filter invariants.
3. Remove the forced synchronous reflow in RouteTransition and skip route choreography entirely under reduced motion. Cancel all scheduled work when navigating again/unmounting.
4. Add meaningful browser checks for the new interaction layer, menu usability and reduced-motion behavior; run existing commerce/theme/navigation tests. Inspect desktop/phone renders of all three primary apps, run UI lint/typecheck and production build as appropriate, record evidence and keep changes local.
