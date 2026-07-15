describe('Projects Dashboard Image URL Scraper', () => {

  it('should collect all image URLs from Projects dashboard cards and download report', () => {
    cy.on('uncaught:exception', () => false)

    cy.viewport(1920, 1080)

    cy.visit('https://pgkltd.co.uk/', { timeout: 120000 })
    cy.url().should('eq', 'https://pgkltd.co.uk/')

   
    cy.get('#menu-landing-page').contains('a', 'Projects').click({ force: true })
    cy.url().should('include', '/projects')

   
    const maxScrolls = 20
    for (let i = 0; i < maxScrolls; i++) {
      cy.scrollTo('bottom')
      cy.wait(1500)
    }

    cy.get('.pgkf-link').then(($cards) => {
      const cardUrls = [...new Set([...$cards].map(a => a.href))]

      cy.log(`Found ${cardUrls.length} project dashboard cards`)
      expect(cardUrls.length).to.be.greaterThan(0)

      
      const results = {}

      cy.wrap(cardUrls).each((url, index) => {
        cy.visit(url, { timeout: 120000 })

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

       
        cy.get('body').then(($body) => {
          const pageImages = []

          $body.find('img').each((_, img) => {
            const src = img.getAttribute('src') ||
              img.getAttribute('data-src') ||
              img.getAttribute('data-orig-src')
            if (src && src.trim() !== '' && src.startsWith('http') && !src.includes('data:image')) {
              pageImages.push(src)
            }

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
       
        const allImageUrls = []
        Object.values(results).forEach(urls => allImageUrls.push(...urls))
        const uniqueImageUrls = [...new Set(allImageUrls)]

        cy.log(`=== SCRAPING COMPLETE ===`)
        cy.log(`Total cards scraped: ${Object.keys(results).length}`)
        cy.log(`Total unique image URLs: ${uniqueImageUrls.length}`)

        const report = {
          scrapeDate: new Date().toISOString(),
          section: 'Projects',
          totalCards: Object.keys(results).length,
          totalUniqueImages: uniqueImageUrls.length,
          cards: results,
          allUniqueImageUrls: uniqueImageUrls,
        }

        
        const reportDir = 'cypress/downloads'
        cy.writeFile(`${reportDir}/project-image-urls.json`, JSON.stringify(report, null, 2))

        const txtLines = [
          '=== PROJECTS DASHBOARD IMAGE URL REPORT ===',
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
        cy.writeFile(`${reportDir}/project-image-urls.txt`, txtLines.join('\n'))

        
        cy.window().then((win) => {
          const jsonBlob = new win.Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
          const jsonUrl = win.URL.createObjectURL(jsonBlob)
          const jsonLink = win.document.createElement('a')
          jsonLink.href = jsonUrl
          jsonLink.download = 'project-image-urls.json'
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
          txtLink.download = 'project-image-urls.txt'
          win.document.body.appendChild(txtLink)
          txtLink.click()
          win.document.body.removeChild(txtLink)
          win.URL.revokeObjectURL(txtUrl)
        })

        cy.log('Report files downloaded: project-image-urls.json & project-image-urls.txt')

        expect(uniqueImageUrls.length).to.be.greaterThan(0)
        uniqueImageUrls.forEach((url) => {
          expect(url).to.not.be.empty
          expect(url).to.match(/^https?:\/\//)
        })
      })
    })
  })

})
