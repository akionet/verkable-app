@SPEC-WFB-002
Feature: Operator console discovery and workflow source

  @F-WFB-R2-01
  Scenario: An operator discovers and starts a generic workflow
    Given the gateway advertises a YAML-backed echo workflow
    When I open the operator console
    And I submit input text "from-bdd"
    Then the echo workflow is started with that JSON
    And the console reports that the run completed

  @F-WFB-R2-02
  Scenario: An operator views exact registered YAML
    Given the gateway advertises a YAML-backed echo workflow
    When I open the operator console
    And I open the raw YAML tab
    Then I see the exact registered YAML read-only

  @F-WFB-R2-02
  Scenario: A code-defined workflow does not fabricate YAML
    Given the gateway advertises a code-defined approval workflow
    When I open the operator console
    And I open the raw YAML tab
    Then I see that no YAML source is available

  @F-WFB-R2-01
  Scenario: A paused workflow is not reported as completed
    Given the gateway advertises an approval workflow that pauses
    When I open the operator console
    And I start the selected workflow
    Then the console reports that the run paused
    And the console does not report that the run completed

  @F-WFB-R2-01
  Scenario: An SSE error is not reported as completed
    Given the gateway advertises an echo workflow that fails
    When I open the operator console
    And I start the selected workflow
    Then the console reports that the run failed
    And the console does not report that the run completed

  @F-WFB-R2-03
  Scenario: An operator watches ordered execution and inspects its safe raw log
    Given the gateway streams an echo execution with an ordered log
    When I open the operator console
    And I start the selected workflow
    Then I see the node transitions and final output in order
    And I can inspect the matching raw execution log

  @F-WFB-R2-04
  Scenario: An operator filters previous runs and opens persisted detail
    Given the gateway has completed echo run history
    When I open previous runs and filter completed runs
    And I reload the previous runs page
    And I open the newest previous run
    Then the history filters survive the reload
    And I see runtime metadata decisions and the ordered persisted log

  @F-WFB-R2-05
  Scenario: An operator decides an opaque paused run and watches it resume
    Given the gateway has an approval run awaiting a decision
    When I start and open the paused approval run
    And I approve it with comment "ship it"
    Then the same run completes after the decision
    And the refreshed audit and continued log are visible
