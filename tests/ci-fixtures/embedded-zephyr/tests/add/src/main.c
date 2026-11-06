#include <zephyr/ztest.h>
#include "add.h"

ZTEST(fixture_add, test_adds_two_numbers)
{
	zassert_equal(fixture_add(2, 3), 5, "2 + 3 should be 5");
}

ZTEST(fixture_add, test_handles_negatives)
{
	zassert_equal(fixture_add(-4, 1), -3, "-4 + 1 should be -3");
}

ZTEST_SUITE(fixture_add, NULL, NULL, NULL, NULL, NULL);
