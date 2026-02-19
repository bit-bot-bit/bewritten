
from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()

    # Log network requests
    page.on("requestfailed", lambda request: print(f"Request failed: {request.url} {request.failure}"))
    page.on("response", lambda response: print(f"Response: {response.status} {response.url}"))

    print("Navigating to app...")
    page.goto("http://localhost:3000", timeout=30000)

    # Wait for initial load
    try:
        page.wait_for_selector('div#root', timeout=10000)
    except:
        print("Root element not found.")
        return

    # Check login
    if page.locator('input[type="email"]').count() > 0:
        print("Login page detected.")
        page.fill('input[type="email"]', 'admin@bewritten.local')
        page.fill('input[type="password"]', 'ChangeMeNow123!')
        page.click('button:has-text("Sign In")')
        time.sleep(2)

    # Check for Password Update
    if page.locator('text=Password Update Required').is_visible():
        print("Password Update Required detected.")
        try:
             pw_inputs = page.locator('input[type="password"]')
             if pw_inputs.count() >= 3:
                 print("Filling password update form...")
                 pw_inputs.nth(0).fill('ChangeMeNow123!')
                 pw_inputs.nth(1).fill('NewPass1234!')
                 pw_inputs.nth(2).fill('NewPass1234!')
                 page.click('button:has-text("Update Password")')
                 print("Password update submitted.")
                 # Wait for dashboard
                 page.wait_for_selector('text=My Stories', timeout=10000)
             else:
                 print("Could not find 3 password inputs.")
        except Exception as e:
            print(f"Error during password update: {e}")

    # Wait for Dashboard (My Stories)
    print("Waiting for dashboard...")
    try:
        # Changed from "Your Stories" to "My Stories"
        page.wait_for_selector('text=My Stories', timeout=10000)
        print("Dashboard loaded.")
    except:
        print("Dashboard not found.")
        page.screenshot(path="/home/jules/verification/dashboard_fail.png")
        # Try to recover?
        # If we see "Start a new journey", we are good.
        if page.locator('text=Start a new journey').is_visible():
             print("Found 'Start a new journey'.")
        else:
             return

    # Create Story
    print("Creating/Selecting story...")
    # Check if stories exist (other than the Add button)
    # The add button is also in the grid.
    # Stories have class "relative group rounded-2xl border..."
    # Let's look for text "Untitled Story" or similar, or just click the first card that isn't the add button?
    # Actually, if we just click the first ".group" inside the grid...

    # Check if there is a story card (not the Add button)
    # The Add button has text "Start a new journey"
    # Story card has "Chapters" text
    if page.locator('text=Chapters').count() > 0:
        print("Opening existing story...")
        page.locator('text=Chapters').first.click()
    else:
        # Click Start a new journey
        try:
            print("Clicking Start a new journey...")
            page.locator('text=Start a new journey').click()
        except:
             print("Could not click Create Story.")

    # Wait for Editor
    print("Waiting for editor...")
    try:
        page.wait_for_selector('div[contenteditable="true"]', timeout=10000)
        print("Editor loaded.")
        page.screenshot(path="/home/jules/verification/editor_loaded.png")
    except:
        print("Editor timeout.")
        page.screenshot(path="/home/jules/verification/editor_fail.png")
        return

    # Verify Character Bible Layout
    print("Navigating to Characters...")
    try:
        # Use shortcut Ctrl+2
        page.keyboard.press("Control+2")
        time.sleep(1)

        # Check if characters tab is active
        # The Sidebar highlights the active tab.
        # But we can check for "Character Manager" text or "Add Character" button
        if page.locator('button:has-text("Add Character")').is_visible() or page.locator('text=No characters found').is_visible():
            print("Characters tab active.")
        else:
            print("Could not switch to Characters tab.")
            page.screenshot(path="/home/jules/verification/char_tab_fail.png")

        # Add Character if needed
        if page.locator('text=No characters found').is_visible():
             print("Adding character...")
             page.click('button:has-text("Add Character")')
             page.fill('input[placeholder="Character Name"]', "Test Char")
             page.click('button:has-text("Save Character")')
             time.sleep(1)

        # Expand Card
        print("Expanding character card...")
        # Find expand button
        expand_btn = page.locator('button:has(svg.lucide-chevron-right)').or_(page.locator('button:has(svg.lucide-chevron-down)')).first
        if expand_btn.is_visible():
            expand_btn.click()
            time.sleep(0.5)
            page.screenshot(path="/home/jules/verification/character_expanded.png")
            print("Expanded screenshot saved to verification/character_expanded.png")
        else:
            print("Expand button not found.")
            page.screenshot(path="/home/jules/verification/char_expand_fail.png")

    except Exception as e:
        print(f"Error in Character Bible: {e}")

    # Verify Breadcrumbs
    print("Navigating to Editor...")
    page.keyboard.press("Control+1")
    time.sleep(1)

    try:
        editor = page.locator('div[contenteditable="true"]')
        editor.click()
        editor.type("Testing breadcrumbs.\n")

        # Add Breadcrumb
        print("Adding breadcrumb...")
        # Find chapter item in sidebar
        # Assuming sidebar is visible
        chapter_item = page.locator('div.group.flex.items-center.justify-between').first
        chapter_item.hover()

        # Find Add Breadcrumb button
        add_btn = page.locator('button[title="Add Breadcrumb"]')
        if add_btn.is_visible():
            add_btn.click()
            time.sleep(0.5)
            page.screenshot(path="/home/jules/verification/breadcrumb_added.png")
            print("Breadcrumb added screenshot saved to verification/breadcrumb_added.png")

            # Verify drag handle
            breadcrumb = page.locator('.breadcrumb-widget').first
            handle = breadcrumb.locator('.breadcrumb-handle')
            if handle.is_visible():
                 print("Drag handle visible.")
            else:
                 print("Drag handle not visible.")
        else:
            print("Add breadcrumb button not visible.")
            page.screenshot(path="/home/jules/verification/no_breadcrumb_btn.png")

    except Exception as e:
        print(f"Error in Breadcrumbs: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
