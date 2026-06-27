import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from pulseroute.agent import DispatchAgent, EMERGENCY_FACILITIES


class TestDispatchAgent(unittest.TestCase):
    def setUp(self):
        self.agent = DispatchAgent()

    def test_find_nearest_facility(self):
        # Coordinates near Lilavati Emergency Care (19.0512, 72.8285)
        facility, dist = self.agent.find_nearest_facility(19.0520, 72.8290, preferred_type="hospital")
        self.assertEqual(facility.facility_id, "FAC-02")
        self.assertLess(dist, 1.0)

    def test_generate_plan_critical_trapped(self):
        plan = self.agent.generate_plan(
            report_id="TEST-01",
            text="Building wall collapsed, 2 workers trapped under heavy debris",
            lat=19.1136,
            lon=72.8697,
            urgency="critical",
            resources=["rescue", "ambulance"]
        )
        self.assertEqual(plan.report_id, "TEST-01")
        self.assertEqual(plan.urgency, "critical")
        self.assertGreater(len(plan.recommended_units), 0)
        self.assertGreater(len(plan.tactical_instructions), 0)
        self.assertIn("PRIORITY CODE RED", plan.tactical_instructions[1])


if __name__ == "__main__":
    unittest.main()
