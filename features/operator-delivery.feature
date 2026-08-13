@SPEC-WFB-002 @F-WFB-R2-06
Feature: Deliver the operator console behind one trusted origin

  Scenario: A fresh operator completes the real workflow lifecycle
    Given the hermetic runtime is available through the console origin
    When I run the YAML-backed echo workflow and reload its history
    And I approve a real paused approval run
    Then the same-origin demo shows the completed decision and continued log
