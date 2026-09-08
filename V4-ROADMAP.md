# Gut Tracker V4 Roadmap

V4 is planned as the next major evolution of the Gut + Glucose Tracker, focused on reducing manual data entry and turning meal logging into actionable nutrition and glucose insights.

## 1. AI Meal Photo Analysis 📷

Allow the user to photograph a meal and receive an estimated nutritional breakdown.

### Proposed workflow

1. User taps **Analyse Meal** in the app.
2. User takes or selects a photo of the meal.
3. The image is sent from the PWA to a secure Supabase Edge Function.
4. The Edge Function calls a vision-capable AI model.
5. The model identifies visible foods and estimates portions.
6. The model returns structured nutrition data.
7. The app presents the estimates for user confirmation/editing before saving.
8. Confirmed values are stored in Supabase using the existing `meals` and `meal_foods` model.

### Nutrition to estimate

- Carbohydrate (g)
- Protein (g)
- Fibre (g)
- Fat (g)
- Calories
- Individual food items and estimated portions
- Confidence/uncertainty where appropriate

### Important limitation

Photo-based portion and nutrition estimates are inherently approximate. The UI must clearly label them as estimates and allow the user to edit portions and values before saving.

## 2. Diabetes-focused meal assessment 🩸

Use the estimated meal composition to provide optional context for type 2 diabetes management.

Potential outputs:

- Estimated carbohydrate load
- Main carbohydrate sources
- Portion-size observations
- Simple meal-quality indicators
- Comparison of the meal with the user's previous glucose responses when sufficient data exists

The feature should provide educational information rather than medical diagnosis or medication advice.

## 3. Gut/FODMAP meal assessment 🥗

Identify potential gut-related triggers from photographed meals, including:

- Wheat/fructans
- Onion/garlic
- Dairy/lactose
- Beans/lentils (GOS)
- Polyols
- Fruit/FODMAP sources
- High-fat or unusually large meals

These should be treated as potential triggers, not confirmed causes of symptoms.

## 4. Meal → Glucose → Gut correlation 📊

Once sufficient glucose data is available, connect:

`Meal → estimated carbs → pre-meal glucose → post-meal glucose → symptoms → bowel movement`

Potential analyses:

- Typical glucose response by carbohydrate amount
- 1-hour vs 2-hour response
- Meals associated with larger glucose excursions
- Foods/meals repeatedly associated with gut symptoms
- Whether the same foods behave differently depending on portion size
- Personal patterns rather than relying only on generic GI tables

## 5. Nutrition-label photo scanning 🏷️

Allow the user to photograph a food nutrition label or barcode and extract nutrition information more accurately than visual meal estimation.

Potential fields:

- Serving size
- Carbohydrate
- Sugars
- Protein
- Fibre
- Fat
- Saturates
- Calories

## 6. Personal food intelligence 🧠

Build a user-specific history of foods and meals so the app can eventually answer questions such as:

- Which breakfasts give me the smallest glucose rise?
- Which foods are repeatedly associated with bloating?
- How does my glucose respond to 30 g vs 60 g carbohydrate meals?
- Which fruit appears most associated with symptoms?
- Which meals give me good satiety without excessive carbohydrate?

## 7. Technical architecture

Preferred architecture:

`PWA → Supabase Edge Function → AI vision API → structured JSON → PWA → Supabase`

Security requirements:

- Never expose an AI API secret key in the browser.
- Keep AI credentials in Supabase/server-side secrets.
- Continue using Supabase Auth and Row Level Security.
- Do not commit personal health data or API secrets to GitHub.
- Validate and constrain AI-generated structured output before storing it.

## 8. Suggested V4 implementation phases

### V4.0 — Foundation

- Secure Edge Function
- AI provider integration
- Structured response schema
- Basic photo upload/capture
- Authentication and RLS validation

### V4.1 — AI Meal Analysis

- Food identification
- Portion estimates
- Carbs/protein/fibre/fat/calories
- Editable confirmation screen
- Save to `meals` + `meal_foods`

### V4.2 — Diabetes Insights

- Carbohydrate-load classification
- Meal/glucose relationship
- Personal glucose response history

### V4.3 — Gut Insights

- FODMAP/trigger detection
- Meal/symptom correlation
- Personal trigger confidence based on repeated observations

### V4.4 — Label & Barcode Scanning

- Nutrition-label OCR/vision
- Barcode lookup where appropriate
- More accurate packaged-food nutrition

### V4.5 — Personal Analytics

- Trends and correlations
- Meal scoring based on the user's own data
- Improved recommendations based on repeated responses

## V4 principle

**AI should reduce logging effort, not replace the user's judgement.** All photo-derived nutrition values should remain editable estimates, and health-related insights should be presented as patterns/education rather than medical diagnoses.
