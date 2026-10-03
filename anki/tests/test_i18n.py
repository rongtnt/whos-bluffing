import string

import i18n


def fields(text):
    return {name for _, name, _, _ in string.Formatter().parse(text) if name}


def test_en_zh_key_parity():
    assert i18n.STRINGS["en"].keys() == i18n.STRINGS["zh"].keys()


def test_placeholders_match():
    for key, en in i18n.STRINGS["en"].items():
        assert fields(en) == fields(i18n.STRINGS["zh"][key]), key


def test_bar_end_labels():
    assert (i18n.t("en", "not_sure"), i18n.t("en", "certain")) == ("Not sure", "Certain")
    assert (i18n.t("zh", "not_sure"), i18n.t("zh", "certain")) == ("没把握", "很有把握")


def test_resolve_language():
    assert i18n.resolve("auto", "zh_CN") == "zh"
    assert i18n.resolve("auto", "zh_TW") == "zh"
    assert i18n.resolve("auto", "en_US") == "en"
    assert i18n.resolve("auto", None) == "en"
    assert i18n.resolve("en", "zh_CN") == "en"
    assert i18n.resolve("zh", "en") == "zh"
