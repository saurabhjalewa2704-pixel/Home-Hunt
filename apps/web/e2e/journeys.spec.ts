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
