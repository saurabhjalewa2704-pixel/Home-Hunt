import { expect, test, type Page } from "@playwright/test";

/**
 * The app starts empty. Tests choose a persona (as a person would on the first screen)
 * and, where they need homes, load the sample homes from Settings.
 */
async function openAs(page: Page, who: "m-saurabh" | "m-vedika", path = "/", opts: { sample?: boolean } = { sample: true }) {
  await page.goto("/");
  await page.evaluate((id) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("hh.me", id);
    localStorage.setItem("hh.me", id);
  }, who);
  if (opts.sample) {
    await page.goto("/settings");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Load sample homes" }).click();
    await expect(page.getByRole("button", { name: "Load sample homes" })).toBeVisible();
  }
  await page.goto(path);
}

test("a fresh install is a clean slate: pick a name, then an empty board with no sample homes", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who's looking today?" })).toBeVisible();
  await expect(page.getByText(/password/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Vedika" }).click();
  await expect(page.getByText("Paste your first listing link")).toBeVisible();
  for (const home of ["Elsynge Road", "Bolingbroke Grove", "Grafton Square", "Ramsden Road"]) {
    await expect(page.getByText(home)).toHaveCount(0);
  }
  // The choice sticks on reload, and "Switch" returns to the picker without deleting anything.
  await page.reload();
  await expect(page.getByText("Paste your first listing link")).toBeVisible();
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.getByRole("heading", { name: "Who's looking today?" })).toBeVisible();
});

test("board ranks the sample homes by tier with scores, gates and the To view group", async ({ page }) => {
  await openAs(page, "m-saurabh");
  await expect(page.getByRole("heading", { name: "Board", level: 1 })).toBeVisible();
  for (const tier of ["Top pick", "Strong contender", "Maybe", "Unlikely", "To view"]) {
    await expect(page.getByRole("region", { name: tier })).toBeVisible();
  }
  const elsynge = page.getByRole("link", { name: /^Elsynge Road, £695,000, score 84, Top pick/ });
  await expect(elsynge).toBeVisible();
  await expect(page.getByRole("link", { name: /^Bolingbroke Grove, £735,000, score 73, Strong contender/ })).toBeVisible();
  await expect(page.getByText("Station over 15 min").locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("You differ by 12 points").locator("visible=true").first()).toBeVisible();
  // Provisional homes are labelled so far, and the over-budget home is collapsed.
  await expect(page.getByRole("link", { name: /Ramsden Road.*so far/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ruled out \(1\)/ })).toBeVisible();
});

test("the PRD worked example shows on the Score tab: 75.5, 69.8, combined 72.6", async ({ page }) => {
  await openAs(page, "m-saurabh", "/property/p-bolingbroke#score");
  await expect(page.getByText("Combined (75.5 + 69.8) ÷ 2 = 72.6")).toBeVisible();
  await expect(page.getByText("Rank 3 of 5. Combined score 72.6.")).toBeVisible();
  await expect(page.getByText("£735,000 leaves £15,000 under your limit.", { exact: true })).toBeVisible();
  await expect(page.getByText("−0.3", { exact: true })).toBeVisible();
  await expect(page.getByText("−2.5", { exact: true })).toBeVisible();
});

test("add a home by hand, see it on the board as provisional", async ({ page }) => {
  await page.route("**/api/proximity", (r) => r.fulfill({ status: 200, json: { origin: { lat: 51.45, lng: -0.15, precision: "exact" }, rows: [{ category: "station", place_name: "Balham", place_lat: 51.443, place_lng: -0.152, walk_min: 7, walk_m: 560, method: "routed" }], unresolved: [], approximate: false } }));
  await openAs(page, "m-vedika", "/add", { sample: false });
  await page.getByRole("button", { name: "Enter the details yourself" }).click();
  await page.getByLabel("Address").fill("Testwood Road, Balham, London SW12");
  await page.getByLabel("Asking price (£)").fill("680000");
  await page.getByLabel("Bedrooms").fill("2");
  await page.getByLabel("Floor area (sq ft)").fill("820");
  await page.getByRole("button", { name: "Save home" }).click();
  await expect(page).toHaveURL(/\/property\//);
  await expect(page.getByRole("heading", { name: "Testwood Road", level: 1 })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Testwood Road, £680,000.*so far/ })).toBeVisible();
});

test("import preview marks fetched and missing fields, then saves; blocked import offers fallbacks", async ({ page }) => {
  await page.route("**/api/import", async (route) => {
    const body = route.request().postDataJSON() as { url?: string };
    if (body.url?.includes("blocked")) return route.fulfill({ status: 422, json: { error: { code: "blocked", message: "The site didn't let us read this listing." } } });
    return route.fulfill({
      json: {
        cover: null,
        result: {
          draft: { portal: "rightmove", listing_url: "https://www.rightmove.co.uk/properties/1", listing_id: "1", asking_price: 710000, price_qualifier: "guide", property_type: "Flat", beds: 2, baths: 2, floor_area_sqft: 860, tenure: "leasehold", lease_years: null, service_charge: 1850, ground_rent: null, council_tax_band: "C", epc: null, address: "Ramsden Mews, Balham, London", postcode: "SW12", lat: null, lng: null, receptions: null, key_features: [], description: null, image_urls: [], agent_name: null, agency: null, agent_phone: null },
          sources: { address: "fetched", asking_price: "fetched", price_qualifier: "fetched", postcode: "inferred", property_type: "fetched", beds: "fetched", baths: "fetched", floor_area_sqft: "fetched", tenure: "fetched", lease_years: "missing", service_charge: "inferred", ground_rent: "missing", council_tax_band: "fetched", epc: "missing" },
          coreFound: 5, needsAi: false,
        },
      },
    });
  });
  await page.route("**/api/proximity", (r) => r.fulfill({ status: 200, json: { origin: { lat: 51.44, lng: -0.15, precision: "approximate" }, rows: [], unresolved: [], approximate: true } }));
  await openAs(page, "m-saurabh", "/add", { sample: false });
  await page.getByLabel(/Listing link/).fill("https://www.rightmove.co.uk/properties/1");
  await page.getByRole("button", { name: "Fetch details" }).click();
  await expect(page.getByRole("heading", { name: "Check what we found" })).toBeVisible();
  await expect(page.getByText("Partial postcode, so walking times are approximate")).toBeVisible();
  await expect(page.getByLabel("Lease years left")).toHaveClass(/inp-miss/);
  await page.getByLabel("Lease years left").fill("104");
  await page.getByRole("button", { name: "Save home" }).click();
  await expect(page.getByRole("heading", { name: "Ramsden Mews", level: 1 })).toBeVisible();

  await page.goto("/add");
  await page.getByLabel(/Listing link/).fill("https://www.zoopla.co.uk/blocked");
  await page.getByRole("button", { name: "Fetch details" }).click();
  await expect(page.getByText("We didn't manage to read this listing")).toBeVisible();
  await expect(page.getByRole("button", { name: /Paste the listing text/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Enter the details yourself/ })).toBeVisible();
  await expect(page.getByLabel(/Listing link/)).toHaveValue("https://www.zoopla.co.uk/blocked");
});

test("ratings stay private until both submit, and the score updates", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3101" });
  // Two tabs of one browser share storage, like two people on one demo.
  const a = await ctx.newPage();
  await a.goto("/");
  await a.evaluate(() => { localStorage.clear(); sessionStorage.setItem("hh.me", "m-saurabh"); localStorage.setItem("hh.me", "m-saurabh"); });
  await a.goto("/settings");
  a.once("dialog", (d) => void d.accept());
  await a.getByRole("button", { name: "Load sample homes" }).click();
  await expect(a.getByRole("button", { name: "Load sample homes" })).toBeVisible();
  await a.goto("/property/p-ramsden#ratings");
  await expect(a.getByText("Rate it first, then compare")).toBeVisible();

  await a.goto("/property/p-ramsden/rate");
  await expect(a.getByRole("heading", { name: "How were the rooms?" })).toBeVisible();
  for (const room of ["Living room", "Kitchen", "Bedroom 1", "Bedroom 2", "Main bathroom"]) {
    await a.getByRole("button", { name: `${room}: Good` }).click();
  }
  await a.getByRole("button", { name: /Next: space/ }).click();
  await a.getByRole("button", { name: "Is the living room big enough for how we live?: Good" }).click();
  await a.getByRole("button", { name: "Is the kitchen big enough to cook and eat?: OK" }).click();
  await a.getByRole("button", { name: /Next: home quality/ }).click();
  for (const q of ["Natural light", "Condition and work needed", "Quiet inside (noise)", "Layout"]) await a.getByRole("button", { name: `${q}: Good` }).click();
  await a.getByRole("button", { name: /Next: location/ }).click();
  await a.getByRole("button", { name: "Street and neighbourhood feel: Excellent" }).click();
  await a.getByRole("button", { name: /Next: pros and cons/ }).click();
  await a.getByLabel(/Type a pro/).fill("Lovely bay window\nQuiet street");
  await a.getByRole("button", { name: "Add pro" }).click();
  await expect(a.getByText("Lovely bay window")).toBeVisible();
  await a.getByRole("button", { name: "Cons (0)" }).click();
  await a.getByLabel(/Type a con/).fill("Bar below the flat");
  await a.getByRole("button", { name: "Add con" }).click();
  await a.getByRole("button", { name: "Deal-breaker" }).click();
  await a.getByRole("button", { name: /Next: gut feel/ }).click();
  await a.getByRole("button", { name: "Could you see yourselves living here?: Excellent" }).click();
  await a.getByRole("button", { name: "Submit and see the score" }).click();
  await expect(a.getByText(/Saved. Here's where Ramsden Road stands./)).toBeVisible();
  await expect(a.getByText(/hasn't rated it yet/)).toBeVisible();

  // A deal-breaker rules the home out for both of you.
  await a.goto("/");
  await expect(a.getByRole("button", { name: /Ruled out \(2\)/ })).toBeVisible();

  // Vedika, in another tab, cannot see Saurabh's ratings until she submits her own.
  const b = await ctx.newPage();
  await b.goto("/");
  await b.evaluate(() => { sessionStorage.setItem("hh.me", "m-vedika"); });
  await b.goto("/property/p-ramsden#ratings");
  await expect(b.getByText("Rate it first, then compare")).toBeVisible();
  await expect(b.getByText("Lovely bay window")).toHaveCount(0);
  await ctx.close();
});

test("settings: weights must add to 100 before saving, and saving re-scores", async ({ page }) => {
  await openAs(page, "m-saurabh", "/settings");
  await expect(page.getByText("Total 100", { exact: true })).toBeVisible();
  await page.getByLabel("Park nearby").fill("20");
  await expect(page.getByText("Total 108, needs to be 100")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await page.getByRole("button", { name: "Scale to 100" }).click();
  await expect(page.getByText("Total 100", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Every home has been re-scored.")).toBeVisible();
});

test("compare shows the best value in each row", async ({ page }) => {
  await openAs(page, "m-saurabh", "/compare");
  await expect(page.getByRole("heading", { name: "Compare", level: 1 })).toBeVisible();
  const price = page.getByRole("row", { name: /^Price/ });
  await expect(price.getByRole("cell", { name: /£650,000.*best/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^Floor area/ }).getByRole("cell", { name: /880 sq ft.*best/ })).toBeVisible();
});

test("schedule pins today, shows legs and downloads an .ics @phone", async ({ page }) => {
  await openAs(page, "m-saurabh", "/schedule");
  await expect(page.getByRole("heading", { name: /Ramsden Road/ }).or(page.getByRole("link", { name: "Ramsden Road" }))).toBeVisible();
  await expect(page.getByText(/Leave by/).first()).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: ".ics" }).first().click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);
});

test("board fits a phone with no sideways scroll @phone", async ({ page }) => {
  await openAs(page, "m-saurabh");
  await expect(page.getByRole("link", { name: /Add a home/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

/** Put a generated PNG on a synthetic clipboard and fire a real paste event, as Cmd/Ctrl+V does. */
async function pasteScreenshots(page: Page, count = 1) {
  await page.evaluate(async (n) => {
    const dt = new DataTransfer();
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas");
      c.width = 900; c.height = 600;
      const g = c.getContext("2d")!;
      g.fillStyle = i ? "#ddd" : "#7aa"; g.fillRect(0, 0, 900, 600);
      g.fillStyle = "#222"; g.font = "40px sans-serif"; g.fillText(`Listing screenshot ${i + 1}`, 40, 80);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      dt.items.add(new File([blob], `shot-${i}.png`, { type: "image/png" }));
    }
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, count);
}

const TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

test("paste screenshots, read them, review, and save with the photo as the home's picture", async ({ page }) => {
  let upload = "";
  await page.route("**/api/extract-screenshots", async (route) => {
    upload = (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString("latin1");
    await route.fulfill({
      json: {
        cover: TINY_JPEG, photoFound: true, unreadable: ["ground_rent"],
        result: {
          draft: { portal: null, listing_url: null, listing_id: "66123", asking_price: 725000, price_qualifier: "guide", property_type: "Flat", beds: 2, baths: 1, floor_area_sqft: 790, tenure: "leasehold", lease_years: 120, service_charge: null, ground_rent: null, council_tax_band: "D", epc: "C", address: "Thurleigh Road, Balham, London", postcode: "SW12 8UB", lat: null, lng: null, receptions: null, key_features: [], description: null, image_urls: [], agent_name: null, agency: null, agent_phone: null },
          sources: { address: "inferred", asking_price: "inferred", price_qualifier: "inferred", postcode: "inferred", property_type: "inferred", beds: "inferred", baths: "inferred", floor_area_sqft: "inferred", tenure: "inferred", lease_years: "inferred", service_charge: "missing", ground_rent: "missing", council_tax_band: "inferred", epc: "inferred" },
          coreFound: 5, needsAi: false,
        },
      },
    });
  });
  await page.route("**/api/proximity", (r) => r.fulfill({ json: { origin: { lat: 51.45, lng: -0.15, precision: "exact" }, rows: [], unresolved: [], approximate: false } }));
  await openAs(page, "m-saurabh", "/add", { sample: false });

  await pasteScreenshots(page, 2);
  await expect(page.getByRole("heading", { name: "Paste screenshots of the listing" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Screenshot \d$/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Remove screenshot 2" }).click();
  await expect(page.getByRole("img", { name: /^Screenshot \d$/ })).toHaveCount(1);

  await page.getByRole("button", { name: "Read the screenshot" }).click();
  await expect(page.getByRole("heading", { name: "Check what we found" })).toBeVisible();
  expect(upload).toContain('name="images"');
  expect(upload).toContain("image/jpeg");
  await expect(page.getByLabel("Address")).toHaveValue("Thurleigh Road, Balham, London");
  await expect(page.getByLabel("Asking price (£)")).toHaveValue("725000");
  // Read from a picture, so it is flagged for a second look; unreadable fields are called out.
  await expect(page.getByText("Worked out, please check").first()).toBeVisible();
  await expect(page.getByText(/Couldn't read: ground rent/)).toBeVisible();
  await expect(page.getByRole("img", { name: "First listing photo" })).toBeVisible();

  await page.getByRole("button", { name: "Save home" }).click();
  await expect(page.getByRole("heading", { name: "Thurleigh Road", level: 1 })).toBeVisible();
  await page.goto("/");
  await expect(page.locator('img[src^="data:image/jpeg"]:visible').first()).toBeVisible();
});

test("without an AI key the screenshot is kept as the photo and the details are typed by hand", async ({ page }) => {
  await page.route("**/api/extract-screenshots", (r) => r.fulfill({ status: 501, json: { error: { code: "no_key", message: "Reading screenshots needs an Anthropic API key." } } }));
  await openAs(page, "m-vedika", "/add", { sample: false });
  await pasteScreenshots(page, 1);
  await page.getByRole("button", { name: "Read the screenshot" }).click();
  await expect(page.getByRole("heading", { name: "Enter the details" })).toBeVisible();
  await expect(page.getByText("Reading screenshots needs an Anthropic API key.")).toBeVisible();
  await expect(page.getByRole("img", { name: "First listing photo" })).toBeVisible();
});

test("a failed read keeps the screenshots so you can retry", async ({ page }) => {
  await page.route("**/api/extract-screenshots", (r) => r.fulfill({ status: 422, json: { error: { code: "unreadable", message: "We couldn't make sense of those screenshots." } } }));
  await openAs(page, "m-vedika", "/add", { sample: false });
  await pasteScreenshots(page, 1);
  await page.getByRole("button", { name: "Read the screenshot" }).click();
  await expect(page.getByText("We couldn't make sense of those screenshots.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Screenshot 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Read the screenshot" })).toBeEnabled();
});

test("upload a PDF: its pages are read, the text goes along, and the agent's details are pre-filled and saved", async ({ page }) => {
  let upload = "";
  await page.route("**/api/extract-screenshots", async (route) => {
    upload = (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString("latin1");
    await route.fulfill({
      json: {
        cover: TINY_JPEG, photoFound: true, unreadable: [],
        result: {
          draft: { portal: null, listing_url: null, listing_id: null, asking_price: 725000, price_qualifier: "guide", property_type: "Flat", beds: 2, baths: null, floor_area_sqft: 790, tenure: "leasehold", lease_years: 120, service_charge: 2400, ground_rent: null, council_tax_band: "D", epc: "C", address: "Thurleigh Road, Balham, London", postcode: "SW12", lat: null, lng: null, receptions: null, key_features: [], description: null, image_urls: [], agent_name: "Sam Reid", agency: "Dwellings Balham", agent_phone: "07700 900123", agent_email: "sam.reid@dwellings.co.uk" },
          sources: { address: "inferred", asking_price: "inferred", beds: "inferred", agent_name: "inferred", agency: "inferred", agent_phone: "inferred", agent_email: "inferred" },
          coreFound: 4, needsAi: false,
        },
      },
    });
  });
  await page.route("**/api/proximity", (r) => r.fulfill({ json: { origin: { lat: 51.45, lng: -0.15, precision: "approximate" }, rows: [], unresolved: [], approximate: false } }));
  await openAs(page, "m-saurabh", "/add", { sample: false });

  await page.locator('input[type="file"][accept*="pdf"]').first().setInputFiles("e2e/fixtures/brochure.pdf");
  // The two pages of the PDF appear as pictures, ready to read.
  await expect(page.getByRole("img", { name: "brochure.pdf page 1" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("img", { name: "brochure.pdf page 2" })).toBeVisible();
  await page.getByRole("button", { name: "Read the listing" }).click();
  await expect(page.getByRole("heading", { name: "Check what we found" })).toBeVisible();

  // Pages went up as images, along with the text printed in the PDF.
  expect(upload).toContain('name="images"');
  expect(upload).toContain('name="pdf_text"');
  expect(upload).toContain("Guide price");
  expect(upload).toContain("sam.reid@dwellings.co.uk");

  await expect(page.getByLabel("Address")).toHaveValue("Thurleigh Road, Balham, London");
  await expect(page.getByLabel("Asking price (£)")).toHaveValue("725000");
  // The agent read from the PDF is filled in for checking, with phone and email.
  await expect(page.getByText("Read from the listing. Please check these details.")).toBeVisible();
  await expect(page.getByLabel("Agent name")).toHaveValue("Sam Reid");
  await expect(page.getByLabel("Agent phone")).toHaveValue("07700 900123");
  await expect(page.getByLabel("Agent email")).toHaveValue("sam.reid@dwellings.co.uk");
  await page.getByRole("button", { name: "Save home" }).click();
  await expect(page.getByRole("heading", { name: "Thurleigh Road", level: 1 })).toBeVisible();

  // The new agent is on the Agents page with a working Call (mobile), Text and Email.
  await page.goto("/agents");
  const card = page.getByRole("region", { name: "Sam Reid" });
  await expect(card.getByText("Dwellings Balham")).toBeVisible();
  await expect(card.getByRole("link", { name: /^Call Sam Reid/ })).toHaveAttribute("href", "tel:07700900123");
  await expect(card.getByRole("link", { name: /^Text Sam Reid/ })).toHaveAttribute("href", "sms:07700900123");
  await expect(card.getByRole("link", { name: /^Email Sam Reid/ })).toHaveAttribute("href", "mailto:sam.reid@dwellings.co.uk");
});

test("a password-protected or broken PDF gets a plain message and nothing is lost", async ({ page }) => {
  await openAs(page, "m-vedika", "/add", { sample: false });
  await page.locator('input[type="file"][accept*="pdf"]').first().setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf") });
  await expect(page.getByText(/couldn't open that PDF/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Upload a PDF" })).toBeVisible();
});

test("agents: add a mobile, office phone and email, with Call, Text and Email links built from them", async ({ page }) => {
  await openAs(page, "m-saurabh", "/agents", { sample: false });
  await page.getByRole("button", { name: "Add an agent" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Priya Shah");
  await page.getByLabel("Agency", { exact: true }).fill("Foxtons");
  await page.getByRole("textbox", { name: "Mobile" }).fill("not a number");
  await expect(page.getByText("That doesn't look like a phone number.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save agent" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Mobile" }).fill("+44 (0)7700 900456");
  await page.getByLabel("Office phone").fill("020 7946 0000");
  await page.getByRole("textbox", { name: "Email" }).fill("priya@foxtons.example");
  await page.getByRole("button", { name: "Save agent" }).click();

  const card = page.getByRole("region", { name: "Priya Shah" });
  // Numbers and email are written out, and the mobile is the one the Call button dials.
  await expect(card.getByText("+44 (0)7700 900456")).toBeVisible();
  await expect(card.getByText("020 7946 0000")).toBeVisible();
  await expect(card.getByRole("link", { name: /^Call Priya Shah/ })).toHaveAttribute("href", "tel:+447700900456");
  await expect(card.getByRole("link", { name: /^Email Priya Shah/ })).toHaveAttribute("href", "mailto:priya@foxtons.example");

  // An agent with no number has no Call button, only what can be done.
  await page.getByRole("button", { name: "Add an agent" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Tom Li");
  await page.getByRole("button", { name: "Save agent" }).click();
  const tom = page.getByRole("region", { name: "Tom Li" });
  await expect(tom.getByText("No phone number or email saved yet.")).toBeVisible();
  await expect(tom.getByRole("link", { name: /^Call/ })).toHaveCount(0);
});

// ---- Mortgage planner ----

test("mortgage calculator: PRD worked example, typed rate, synced deposit, and errors keep the last result", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage", { sample: false });
  const pay = page.getByTestId("monthly-payment");
  // £695,000, 15% down, 30 years at 5.15%: the PRD's scenario B.
  await expect(pay).toHaveText("£3,225.65");
    await expect(page.getByText("£570,484", { exact: true }).locator("visible=true")).toBeVisible();
  await expect(page.getByText("£1,161,234", { exact: true }).locator("visible=true")).toBeVisible();
  await expect(page.getByText("£132,499", { exact: true }).locator("visible=true")).toBeVisible(); // cash needed on day one
  await expect(page.getByText("Estimates only. Confirm with a mortgage adviser.").first()).toBeVisible();

  // Deposit pounds and percent stay in sync; editing the price keeps the percent.
  await page.getByLabel("Deposit (%)").fill("10");
  await expect(page.getByLabel("Deposit (£)")).toHaveValue("69500");
  await expect(page.getByText("90% loan-to-value, 90% band")).toBeVisible();
  await expect(page.getByText("£34,750 more deposit gets you to the 85% band")).toBeVisible();
  await page.getByLabel("Price", { exact: true }).fill("600000");
  await expect(page.getByLabel("Deposit (£)")).toHaveValue("60000");
  await page.getByLabel("Price", { exact: true }).fill("695000");
  await page.getByLabel("Deposit (%)").fill("15");
  await expect(pay).toHaveText("£3,225.65");

  // Typed rate: 4.89 moves the slider and the payment; 9.25 is kept while the slider rests at 8.
  await page.getByLabel("Interest rate", { exact: true }).fill("4.89");
  await expect(page.getByLabel("Interest rate slider")).toHaveValue("4.9");
  await expect(pay).not.toHaveText("£3,225.65");
  await page.getByLabel("Interest rate", { exact: true }).fill("9.25");
  await expect(page.getByLabel("Interest rate", { exact: true })).toHaveValue("9.25");
  await expect(page.getByLabel("Interest rate slider")).toHaveValue("8");
  await expect(page.getByText("Your rate is outside the slider's range, which is fine.")).toBeVisible();
  const at925 = await pay.textContent();

  // Blank is an error under the field, and the last valid result stays on screen.
  await page.getByLabel("Interest rate", { exact: true }).fill("");
  await expect(page.getByText("Enter a rate between 0.01% and 15%.")).toBeVisible();
  await expect(pay).toHaveText(at925!);
  await expect(page.getByText("Showing your last valid result")).toBeVisible();

  // A higher rate after the fix shows what not remortgaging costs: £3,925.84 from year 6 (PRD section 6).
  await page.getByLabel("Interest rate", { exact: true }).fill("5.15");
  await expect(pay).toHaveText("£3,225.65");
  await page.getByLabel("After the fix, assume we remortgage at the same rate").uncheck();
  await page.getByLabel("Rate after the fix", { exact: true }).fill("7.24");
  await expect(page.getByText("Rising to £3,925.84 a month after year 5 if you don't remortgage")).toBeVisible();
});

test("a deposit above the price is refused in plain words", async ({ page }) => {
  await openAs(page, "m-vedika", "/mortgage", { sample: false });
  await page.getByLabel("Deposit (£)").fill("900000");
  await expect(page.getByText("Your deposit can't be more than the price.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as scenario" })).toBeDisabled();
});

test("our plan drives the property page, the board line and the compare row; Mortgage is in the navigation", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Mortgage" })).toBeVisible();
  const costs = async (street: RegExp) => {
    await page.goto("/");
    await page.getByRole("link", { name: street }).first().click();
    await page.getByRole("navigation", { name: "Property sections" }).getByRole("link", { name: "Costs" }).click();
    return page.getByRole("region", { name: "Mortgage" });
  };

  // The sample scenario B is starred as "our plan": its terms apply to each home at that home's own price.
  const elsynge = await costs(/Elsynge Road/);
  await expect(elsynge.getByText("£3,225.65")).toBeVisible();
  await expect(elsynge.getByText("£132,499")).toBeVisible();
  const fircroft = await costs(/Fircroft Road/);
  await expect(fircroft.getByText("£3,225.65")).toHaveCount(0);
  await expect(fircroft.getByText(/£3,0\d\d\.\d\d/)).toBeVisible(); // £650,000 at 15% down
  await page.getByRole("link", { name: "Model this home" }).click();
  await expect(page.getByLabel("Home from your board")).toHaveValue(/.+/);
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("650000");
  await expect(page.getByText("15%, £97,500")).toBeVisible();

  // Unstar it and the Costs tab invites you to star one.
  await page.goto("/mortgage/scenarios");
  await page.getByRole("button", { name: "Our plan. Unstar" }).click();
  const none = await costs(/Elsynge Road/);
  await expect(none.getByText(/Star a scenario as/)).toBeVisible();
  await page.goto("/mortgage/scenarios");
  await page.getByRole("button", { name: "Make B our plan" }).click();

  // The board line is off until switched on in Settings.
  await page.goto("/");
  await expect(page.getByText(/a month$/)).toHaveCount(0);
  await page.goto("/settings");
  await page.getByLabel(/Show each home's monthly payment on the board/).check();
  await page.getByRole("button", { name: "Save mortgage settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/about £[\d,]+ a month/).locator("visible=true").first()).toBeVisible();

  // And the compare screen gets a monthly payment row.
  await page.goto("/compare");
  await expect(page.getByRole("rowheader", { name: "Monthly payment (our plan)" })).toBeVisible();
});

test("saving from the calculator makes the first scenario our plan", async ({ page }) => {
  await openAs(page, "m-vedika", "/mortgage", { sample: false });
  await page.getByRole("button", { name: "Save as scenario" }).click();
  await expect(page).toHaveURL(/\/mortgage\/scenarios/);
  await expect(page.locator(".mcard").filter({ hasText: "A. 15% down, 30 yrs, 5.15%" })).toBeVisible();
  await expect(page.getByText("Our plan", { exact: true })).toBeVisible();
});

test("scenarios: compare the PRD's four, best value per row, quick variants, duplicate, delete, selection remembered", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage/scenarios");
  await expect(page.getByRole("heading", { name: "Your scenarios" })).toBeVisible();
  const table = page.getByRole("region", { name: "Side-by-side comparison" });
  const row = (name: string) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });

  // PRD section 7: C is cheapest each month and overall, D has the lowest interest, A needs least cash.
  await expect(row("Monthly payment")).toContainText("£3,492.88");
  await expect(row("Monthly payment").locator("td.best")).toContainText("£2,750.59");
  await expect(row("Total interest").locator("td.best")).toContainText("£460,837");
  await expect(row("Total payable").locator("td.best")).toContainText("£990,214");
  await expect(row("Cash needed on day one").locator("td.best")).toContainText("£97,749");
  await expect(row("Cash needed on day one")).toContainText("+£104,250");
  await expect(row("Term").locator("td.best")).toContainText("25 years");
  await expect(page.getByText("D costs £280 more a month than B but saves £109,647 of interest.")).toBeVisible();

  // Untick two: the table follows, and it is remembered on reload.
  await page.getByLabel("Compare A").uncheck();
  await page.getByLabel("Compare C").uncheck();
  await expect(table.getByRole("columnheader")).toHaveCount(2); // B and D
  await page.reload();
  await expect(page.getByLabel("Compare A")).not.toBeChecked();
  await expect(page.getByLabel("Compare B")).toBeChecked();
  await page.getByLabel("Compare A").check();
  await page.getByLabel("Compare C").check();

  // Quick variants: term 25, 30 and 35 from B. 30 is B's own value, so two new scenarios.
  await page.getByRole("button", { name: "Quick variants" }).click();
  await page.getByLabel("Start from").selectOption({ label: "B. Our plan: 15% down" });
  await expect(page.getByLabel(/Values/)).toHaveValue("25, 30, 35");
  await expect(page.getByText(/This makes 2 scenarios: 25 yrs, 35 yrs/)).toBeVisible();
  await page.getByRole("button", { name: "Make 2 scenarios" }).click();
  await expect(page.locator(".mcard").filter({ hasText: "E. 15% down, 25 yrs, 5.15%" })).toBeVisible();
  await expect(page.locator(".mcard").filter({ hasText: "F. 15% down, 35 yrs, 5.15%" })).toBeVisible();

  // Only six can be compared at once; a seventh scenario can exist but not be ticked.
  for (const l of ["A", "B", "C", "D", "E", "F"]) await page.getByLabel(`Compare ${l}`).check();
  await page.getByRole("button", { name: "Duplicate A" }).click();
  await expect(page.locator(".mcard").filter({ hasText: "G. 10% down, 30 yrs, 5.35% copy" })).toBeVisible();
  await page.getByLabel("Compare G").click();
  await expect(page.getByText("You can compare up to 6 at a time. Untick one first.")).toBeVisible();
  await expect(page.getByLabel("Compare G")).not.toBeChecked();

  // Delete the copy.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete G" }).click();
  await expect(page.locator(".mcard").filter({ hasText: "G. 10% down, 30 yrs, 5.35% copy" })).toHaveCount(0);
});

test("the PRD's four scenarios can be exported as CSV", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage/scenarios");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download as CSV" }).click()]);
  const text = await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8");
  expect(text.split("\n")[0]).toContain("A. 10% down, 30 yrs, 5.35%");
  expect(text).toContain("Monthly payment,3492.88,3225.65,2750.59,3505.29");
});

test("settings: the overpayment allowance and defaults feed new calculators", async ({ page }) => {
  await openAs(page, "m-saurabh", "/settings", { sample: false });
  await page.getByLabel("Default term").fill("25");
  await page.getByLabel("Arrangement fee", { exact: true }).fill("1499");
  await page.getByRole("button", { name: "Save mortgage settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/mortgage");
  await expect(page.getByLabel("Years", { exact: true })).toHaveValue("25");
  await expect(page.getByLabel("Arrangement fee", { exact: true })).toHaveValue("1499");
});

test("overpayments: the PRD's golden figures on scenario B, presets, and lower-the-payment", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage/overpayments");
  const head = page.getByTestId("op-headline");
  const vis = (t: string | RegExp) => page.getByText(t, { exact: typeof t === "string" }).locator("visible=true").first();

  // £10,000 a year on B (£590,750 at 5.15% over 30 years).
  await expect(head).toHaveText("Overpaying £10,000 a year clears the mortgage 10 years 8 months early and saves £224,962 in interest.");
  await expect(vis("19 years 4 months")).toBeVisible();
  const vs = page.getByRole("table").filter({ hasText: "Original term against overpaying" });
  const total = vs.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Total payable", exact: true }) });
  await expect(total).toContainText("£1,161,234");
  await expect(total).toContainText("£936,272");
  await expect(total).toContainText("£224,962");
  await expect(vs.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Overpayments" }) })).toContainText("£190,000");
  await expect(vs.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Regular monthly payments in total" }) })).toContainText("£746,272");
  await expect(page.getByText("Each £1 overpaid saves about £1.18")).toBeVisible();

  // Presets.
  await page.getByRole("button", { name: "£5,000 a year" }).click();
  await expect(vis("23 years 4 months")).toBeVisible(); // 280 months, so 6 years 8 months early
  await expect(head).toContainText("£143,092");
  await page.getByRole("button", { name: "5% a year", exact: true }).click();
  await expect(head).toContainText("saves £330,055 in interest");
  await expect(vis("15 years 3 months")).toBeVisible();
  await page.getByRole("button", { name: "£10,000 a year" }).click();
  await page.getByLabel("Or type an amount").fill("20000");
  await expect(head).toContainText("£317,128");
  await page.getByLabel("Or type an amount").fill("10000");

  // Lower the payment instead: £3,170.25 after the first overpayment, £130,828 saved.
  await page.getByRole("button", { name: "Pay less each month" }).click();
  await expect(head).toHaveText("Overpaying £10,000 a year lowers your payment to £3,170.25 a month after the first overpayment and saves £130,828 in interest.");

  // Compare both outcomes side by side.
  await page.getByRole("button", { name: "Compare both" }).click();
  const both = page.getByRole("region", { name: "Both outcomes side by side" });
  await expect(both).toContainText("£224,962");
  await expect(both).toContainText("£130,828");
});

test("overpayments: the allowance warning during the fix, and none after it", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage/overpayments");
  await page.getByLabel("Or type an amount").fill("70000");
  const alert = page.getByRole("alert").filter({ hasText: "allowance" });
  await expect(alert).toContainText("In year 1 you'd overpay £10,925 more than the 10% allowance of £59,075.");
  await expect(alert).toContainText("Your lender may charge an early repayment charge on that amount");
  await expect(page.locator("tr.mrow-warn").first()).toContainText("£70,000");
  // The same overpayment only after the fix ends is fine.
  await page.getByRole("button", { name: "After the fix ends" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "allowance" })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /^6 / }).getByText("No limit")).toBeVisible();
});

test("overpayments: a lump sum and a monthly amount; save the plan to a scenario and see it in Scenarios", async ({ page }) => {
  await openAs(page, "m-saurabh", "/mortgage/overpayments");
  const head = page.getByTestId("op-headline");
  await page.getByRole("button", { name: "A one-off lump sum" }).click();
  await page.getByLabel("Or type an amount").fill("30000");
  await expect(head).toContainText("a one-off £30,000");
  await page.getByRole("button", { name: "A fixed amount each month" }).click();
  await page.getByLabel("Or type an amount").fill("500");
  await expect(head).toContainText("£500 a month");
  await page.getByRole("button", { name: "A fixed amount each year" }).click();
  await page.getByRole("button", { name: "£10,000 a year" }).click();

  await page.getByRole("button", { name: "Save to scenario B" }).click();
  await expect(page.getByRole("button", { name: "Saved to scenario B" })).toBeDisabled();
  await page.goto("/mortgage/scenarios");
  await expect(page.locator(".mcard").filter({ hasText: "B. Our plan" })).toContainText("Overpaying saves £224,962");
  const table = page.getByRole("region", { name: "Side-by-side comparison" });
  await expect(table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "With overpayments: interest saved" }) })).toContainText("£224,962");
});

test("the calculator hands a new scenario to the simulator", async ({ page }) => {
  await openAs(page, "m-vedika", "/mortgage", { sample: false });
  await page.getByRole("button", { name: "Save and try overpaying" }).click();
  await expect(page).toHaveURL(/\/mortgage\/overpayments\?scenario=/);
  await expect(page.getByLabel("Mortgage", { exact: true })).toContainText("A. 15% down, 30 yrs, 5.15%");
  await expect(page.getByTestId("op-headline")).toContainText("saves £224,962 in interest");
});

test("with no scenario the simulator asks you to save one first", async ({ page }) => {
  await openAs(page, "m-vedika", "/mortgage/overpayments", { sample: false });
  await expect(page.getByText("Save a scenario first")).toBeVisible();
});

test("the mortgage screens fit a phone with no sideways scroll, and the tab bar carries Mortgage @phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  await openAs(page, "m-saurabh", "/mortgage");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Mortgage" })).toBeVisible();
  for (const path of ["/mortgage", "/mortgage/scenarios", "/mortgage/overpayments"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Mortgage", level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  // Settings moved into the profile menu on phones.
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
