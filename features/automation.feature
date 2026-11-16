Feature: Read-only automation reports
  @OBS-001-F1-01
  Scenario: An operator reads a tenant's automation report
    Given Observe serves a valid report for an alternative tenant
    When I open that tenant's Automation view
    Then I see the report timeline, published recipes, judge stops and errors
    And the headline trends are drawn with Vega-Lite
    And Observe requests are same-origin GETs without credentials

  @OBS-001-F1-02
  Scenario: An operator finds the oldest current human gate
    Given Observe serves a valid report for an alternative tenant
    When I open that tenant's Automation view
    Then the current pending queue shows oldest first with age workflow reason and issue links

  @OBS-001-F1-01 @OBS-001-F1-02 @observe-live
  Scenario: Local acceptance against the configured vault-backed Observe service
    Given a live Observe organisation and space are configured for acceptance
    When I open the live Automation view
    Then its report and pending counts match the live API and evidence is captured
