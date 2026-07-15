describe('Kitchen Dashboard Image URL Scraper', () => {

  it('should collect all image URLs from Kitchen dashboard cards and download report', () => {
    cy.on('uncaught:exception', () => false)

    cy.viewport(1920, 1080)

    // Step 1: Visit homepage
    cy.visit('https://pgkltd.co.uk/', { timeout: 120000 })
    cy.url().should('eq', 'https://pgkltd.co.uk/')

    // Step 2: Click "Kitchens" in the navigation bar
    cy.get('#menu-landing-page').contains('a', 'Kitchens').click({ force: true })
    cy.url().should('include', '/kitchens')

    // Step 3: Collect all dashboard card URLs from the Kitchen dashboard
    cy.get('a[href]').then(($links) => {
      const allHrefs = [...new Set([...$links].map(a => a.href))]

      const cardUrls = allHrefs.filter(href =>
        href.match(/\/collections\/[^/]+\/$/) ||
        href.match(/\/portfolio\/[^/]+\/$/)
      )

      cy.log(`Found ${cardUrls.length} kitchen dashboard cards`)
      expect(cardUrls.length).to.be.greaterThan(0)

      // Step 4: Open each card one by one and extract image URLs
      const results = {}

      cy.wrap(cardUrls).each((url, index) => {
        cy.visit(url, { timeout: 120000 })

        // Scroll the full page to trigger lazysizes lazy-loading
        cy.window().then((win) => {
          const doc = win.document
          const scrollHeight = doc.body.scrollHeight
          const step = win.innerHeight
          let currentScroll = 0
          const scrollInterval = win.setInterval(() => {
            currentScroll += step
            if (currentScroll >= scrollHeight) {
              win.clearInterval(scrollInterval)
            }
            win.scrollTo(0, currentScroll)
          }, 200)
        })

        cy.wait(2000)

        // Extract all image URLs from the card page
        cy.get('body').then(($body) => {
          const pageImages = []

          // img tags: src, data-src, data-orig-src
          $body.find('img').each((_, img) => {
            const src = img.getAttribute('src') ||
              img.getAttribute('data-src') ||
              img.getAttribute('data-orig-src')
            if (src && src.trim() !== '' && src.startsWith('http') && !src.includes('data:image')) {
              pageImages.push(src)
            }

            // data-srcset responsive images
            const srcset = img.getAttribute('data-srcset')
            if (srcset) {
              srcset.split(',').forEach(entry => {
                const urlPart = entry.trim().split(/\s+/)[0]
                if (urlPart && urlPart.startsWith('http')) {
                  pageImages.push(urlPart)
                }
              })
            }
          })

          // lazysizes background images: data-bg, data-bg-src
          $body.find('[data-bg]').each((_, el) => {
            const bg = el.getAttribute('data-bg')
            if (bg && bg.trim().startsWith('http')) {
              pageImages.push(bg)
            }
          })

          $body.find('[data-bg-src]').each((_, el) => {
            const bg = el.getAttribute('data-bg-src')
            if (bg && bg.trim().startsWith('http')) {
              pageImages.push(bg)
            }
          })

          // Inline style background-image
          $body.find('[style*="background-image"]').each((_, el) => {
            const style = el.getAttribute('style') || ''
            const match = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/)
            if (match && match[1]) {
              pageImages.push(match[1])
            }
          })

          results[url] = [...new Set(pageImages)]
        })

        cy.log(`Card ${index + 1}/${cardUrls.length}: ${url}`)
      }).then(() => {
        // Step 5: Compile final report
        const allImageUrls = []
        Object.values(results).forEach(urls => allImageUrls.push(...urls))
        const uniqueImageUrls = [...new Set(allImageUrls)]

        cy.log(`=== SCRAPING COMPLETE ===`)
        cy.log(`Total cards scraped: ${Object.keys(results).length}`)
        cy.log(`Total unique image URLs: ${uniqueImageUrls.length}`)

        // Build the report object
        const report = {
          scrapeDate: new Date().toISOString(),
          totalCards: Object.keys(results).length,
          totalUniqueImages: uniqueImageUrls.length,
          cards: results,
          allUniqueImageUrls: uniqueImageUrls,
        }

        // Step 6: Save report files to project
        const reportDir = 'cypress/downloads'
        cy.writeFile(`${reportDir}/kitchen-image-urls.json`, JSON.stringify(report, null, 2))

        const txtLines = [
          '=== KITCHEN DASHBOARD IMAGE URL REPORT ===',
          `Generated: ${report.scrapeDate}`,
          `Total Cards Scraped: ${report.totalCards}`,
          `Total Unique Image URLs: ${report.totalUniqueImages}`,
          '',
          '--- ALL UNIQUE IMAGE URLs ---',
          ...uniqueImageUrls.map((url, i) => `${i + 1}. ${url}`),
          '',
          '--- URLS BY CARD ---',
        ]
        Object.entries(results).forEach(([cardUrl, urls]) => {
          txtLines.push(`\n[Card] ${cardUrl}`)
          urls.forEach((url, i) => txtLines.push(`  ${i + 1}. ${url}`))
        })
        cy.writeFile(`${reportDir}/kitchen-image-urls.txt`, txtLines.join('\n'))

        // Step 7: Trigger browser download
        cy.window().then((win) => {
          const jsonBlob = new win.Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
          const jsonUrl = win.URL.createObjectURL(jsonBlob)
          const jsonLink = win.document.createElement('a')
          jsonLink.href = jsonUrl
          jsonLink.download = 'kitchen-image-urls.json'
          win.document.body.appendChild(jsonLink)
          jsonLink.click()
          win.document.body.removeChild(jsonLink)
          win.URL.revokeObjectURL(jsonUrl)
        })

        cy.window().then((win) => {
          const txtContent = txtLines.join('\n')
          const txtBlob = new win.Blob([txtContent], { type: 'text/plain' })
          const txtUrl = win.URL.createObjectURL(txtBlob)
          const txtLink = win.document.createElement('a')
          txtLink.href = txtUrl
          txtLink.download = 'kitchen-image-urls.txt'
          win.document.body.appendChild(txtLink)
          txtLink.click()
          win.document.body.removeChild(txtLink)
          win.URL.revokeObjectURL(txtUrl)
        })

        cy.log('Report files downloaded: kitchen-image-urls.json & kitchen-image-urls.txt')

        expect(uniqueImageUrls.length).to.be.greaterThan(0)
        uniqueImageUrls.forEach((url) => {
          expect(url).to.not.be.empty
          expect(url).to.match(/^https?:\/\//)
        })
      })
    })
  })

})
