# LLM food and hydration logging plan

## Discovery

- The app is a static PWA. `index.html` loads browser-global modules from `utils/`,
  `services/`, and `ui/`; it has no build step.
- Supabase is the source of truth. The live project and schema snapshot confirm that
  `meals`, `meal_foods`, and `water_intake` are the appropriate existing targets.
  All are RLS-protected; meal-food ownership is enforced through the parent meal.
- `meals` already has carbohydrate, protein, fibre, and trigger fields. `meal_foods`
  has name, portion, portion unit, carbohydrate, fibre, and notes. `water_intake`
  is meal-linkable and distinguishes `manual` and `meal` sources.
- Missing elements: ingredient-level protein/calories/sugars/fat and a durable,
  user-owned idempotency key for retry-safe multi-record saves. These will be added
  without replacing the existing data model.

## Design

1. Add a versioned response contract and pure browser validation/total-calculation
   helpers. Values are estimates, nullable where unknown, bounded, and never treated
   as medical advice.
2. Add an authenticated Supabase Edge Function. It verifies the user JWT, reads the
   LLM API key only from function secrets, asks the provider for JSON Schema output,
   validates the response, and returns no database-generated IDs.
3. Add a focused review workflow to the Food tab: natural-language input, Analyse,
   clarification display, editable ingredient/drink rows, diabetes-context copy,
   and an explicit Save to journal action.
4. Save approved meals and their ingredient rows together through an RPC transaction;
   create one meal-linked water row per approved plain-water drink. A user-provided
   idempotency key makes retries return the original saved IDs rather than duplicate
   records. Other beverages remain in the meal description; plain water is never
   double-counted.
5. Add a migration with RLS-safe owner policies and an atomic `SECURITY INVOKER` RPC.
   Do not use a service-role key or an RLS-bypassing function. Regenerate types and
   update the schema snapshot after applying the migration.
6. Add mocked unit coverage for valid food, drink, and mixed output; ambiguity,
   invalid output, totals, idempotency payload creation, and local-date hydration.
   Add smoke coverage for the review workflow.

## Delivery boundaries

- No LLM, Supabase secret, or personal health data is committed or sent from the
  browser outside the authenticated Edge Function.
- The LLM is a nutrition estimate, not a diagnosis or insulin/medication advice.

## Deployment configuration

- Required Edge Function secret: `GROQ_API_KEY`.
- Optional Edge Function secret: `GROQ_MODEL` (defaults to `openai/gpt-oss-20b`).
- Deploy `analyse-food-log` with JWT verification enabled. Apply the included
  migration before deployment; the browser calls the owner-scoped RPC and never
  receives a service-role key.
- Deployment of database changes and the Edge Function is separate from source
  changes and will only be attempted after the implementation is validated.

## Example contract result

`"Two scrambled eggs, two slices of wholemeal toast and a teaspoon of butter"`
returns a `mixed`/`meal` response with three ingredient rows, estimated totals,
assumptions for unstated slice weight, and a cautious glucose-impact explanation.
`"Two glasses of water, approximately 250 ml each"` returns two plain-water drink
rows totalling 500 ml and no food ingredients.
