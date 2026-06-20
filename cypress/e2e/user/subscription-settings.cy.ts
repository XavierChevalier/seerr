describe('User Subscription Settings', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('opens the subscription tab for another user', () => {
    cy.visit('/users');

    cy.get('[data-testid=user-list-row]')
      .contains(Cypress.env('USER_EMAIL'))
      .parents('[data-testid=user-list-row]')
      .find('[data-testid=user-list-username-link]')
      .click();

    cy.contains('Edit Settings').click();
    cy.contains('Abonnement').click();

    cy.url().should('include', '/settings/subscription');
    cy.contains('Subscription Settings').should('be.visible');
    cy.contains('Base Configuration').should('be.visible');
    cy.contains('Payment History').should('be.visible');
    cy.contains('Gifted Months').should('be.visible');
  });

  it('loads subscription data from the API', () => {
    cy.visit('/users');

    cy.get('[data-testid=user-list-row]')
      .contains(Cypress.env('USER_EMAIL'))
      .parents('[data-testid=user-list-row]')
      .find('[data-testid=user-list-username-link]')
      .then(($link) => {
        const href = $link.attr('href');
        expect(href).to.match(/\/users\/\d+$/);

        cy.intercept('GET', '/api/v1/user/*/subscription').as(
          'getSubscription'
        );

        cy.wrap($link).click();
        cy.contains('Edit Settings').click();
        cy.contains('Abonnement').click();

        cy.wait('@getSubscription')
          .its('response.statusCode')
          .should('eq', 200);
        cy.contains('Status').should('be.visible');
      });
  });

  it('opens the admin subscription payments page', () => {
    cy.intercept('GET', '/api/v1/subscription/payments?status=pending').as(
      'getSubscriptionPayments'
    );

    cy.visit('/subscriptions');

    cy.wait('@getSubscriptionPayments')
      .its('response.statusCode')
      .should('eq', 200);
    cy.contains('Payment List').should('be.visible');
    cy.get('table').should('be.visible');
  });

  it('shows admin subscription menu in sidebar', () => {
    cy.get('[data-testid=sidebar-menu-subscriptions]').should('be.visible');
  });

  it('shows Abonnement menu when subscription is configured', () => {
    cy.request('PUT', `/api/v1/user/${Cypress.env('USER_ID')}/subscription`, {
      pricePerMonth: 10,
      startDate: '2024-01-01',
      preference: 'Mensuel',
    });

    cy.loginAsUser();
    cy.get('[data-testid=sidebar-menu-subscription]').should('be.visible');
    cy.visit('/subscription');
    cy.contains('Déclarer un virement').should('be.visible');
  });

  it('shows overdue banner on discover when behind', () => {
    cy.request('PUT', `/api/v1/user/${Cypress.env('USER_ID')}/subscription`, {
      pricePerMonth: 10,
      startDate: '2020-01-01',
      preference: 'Mensuel',
    });

    cy.loginAsUser();
    cy.visit('/');
    cy.contains('Abonnement en retard').should('be.visible');
  });
});
