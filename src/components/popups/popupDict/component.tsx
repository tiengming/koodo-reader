import React from "react";
import "./popupDict.css";
import { PopupDictProps, PopupDictState } from "./interface";
import { dictList } from "../../../constants/dictList";
import StorageUtil from "../../../utils/serviceUtils/storageUtil";
import Parser from "html-react-parser";
import * as DOMPurify from "dompurify";
import axios from "axios";
import { getBingDict } from "../../../utils/serviceUtils/bingDictUtil";
import { openExternalUrl } from "../../../utils/serviceUtils/urlUtil";
declare var window: any;
class PopupDict extends React.Component<PopupDictProps, PopupDictState> {
  constructor(props: PopupDictProps) {
    super(props);
    this.state = {
      dictText: "",
      dictService: StorageUtil.getReaderConfig("dictService"),
      dictTarget: StorageUtil.getReaderConfig("dictTarget"),
    };
  }
  componentDidMount() {
    let originalText = this.props.originalText.replace(/(\r\n|\n|\r)/gm, "");
    this.handleDict(originalText);
  }
  handleDict = async (text: string) => {
    if (StorageUtil.getReaderConfig("dictService") === "必应词典") {
      const { ipcRenderer } = window.require("electron");
      const html = await ipcRenderer.invoke("get-url-content", {
        url: `https://cn.bing.com/dict/search?mkt=zh-cn&q=${encodeURIComponent(
          text
        )}`,
      });
      if (html) {
        let res: any = await getBingDict(html);
        if (res === "error") {
          this.setState({
            dictText: this.props.t("Error happens"),
          });
          return;
        }
        let dictText = Object.keys(res)
          .filter((item) => item !== "result")
          .map((item) => {
            if (res[item]) {
              return `<p><span style="font-weight: bold">[${item}]</span> ${res[item]}</p>`;
            } else {
              return "";
            }
          })
          .join("");
        this.setState({
          dictText: dictText,
        });
      } else {
        this.setState({
          dictText: this.props.t("Error happens"),
        });
      }
    } else if (
      StorageUtil.getReaderConfig("dictService") === "Google Dictionary"
    ) {
      const { ipcRenderer } = window.require("electron");
      console.log(text);
      const html = await ipcRenderer.invoke("get-url-content", {
        url: `https://www.google.com/search?q=define+${encodeURIComponent(
          text
        )}`,
      });
      if (html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const parentElement = Array.from(doc.querySelectorAll(".kCrYT"))[1];
        console.log(parentElement);
        var aNodes = parentElement.querySelectorAll("a");
        if (aNodes.length > 0) {
          this.setState({
            dictText: this.props.t("Error happens"),
          });
          return;
        }
        var childElements = parentElement.querySelectorAll(".r0bn4c");
        console.log(childElements);
        // 遍历子元素并移除特定的子元素
        for (var i = 0; i < childElements.length; i++) {
          var childElement = childElements[i];
          if (
            childElement.textContent &&
            (childElement.textContent?.indexOf("synonyms") > -1 ||
              childElement.textContent?.indexOf('"') > -1)
          ) {
            childElement.parentNode &&
              childElement.parentNode.removeChild(childElement);
          }
          if (childElement.textContent) {
            childElement.textContent = childElement.textContent.trim();
          }
        }
        console.log(parentElement);
        this.setState({
          dictText: parentElement.innerHTML,
        });
      } else {
        this.setState({
          dictText: this.props.t("Error happens"),
        });
      }
    } else {
      axios
        .get(`https://api.dictionaryapi.dev/api/v2/entries/en/${text}`)
        .then((res: any) => {
          let dictText = res.data[0].meanings
            .map((item) => {
              return `<p><span style="font-weight: bold">[${
                item.partOfSpeech
              }]</span><div>${item.definitions
                .map((item, index) => {
                  console.log(item.definition);
                  return (
                    `<span style="font-weight: bold">${index + 1}</span>` +
                    ". " +
                    item.definition
                  );
                })
                .join("</div><div>")}</div></p>`;
            })
            .join("");
          this.setState({
            dictText: dictText,
          });
        })
        .catch((err) => {
          this.setState({
            dictText: this.props.t("Error happens"),
          });
        });
    }
  };
  handleYandexReturn = (list) => {
    let typeList: string[] = [];
    list.forEach((item) => {
      if (typeList.indexOf(item.pos) === -1) {
        typeList.push(item.pos);
      }
    });
    return typeList.map((type) => {
      return {
        type,
        definitions: list
          .filter((item) => item.pos === type)
          .map((item) => item.text)
          .join(","),
      };
    });
  };
  render() {
    const renderNoteEditor = () => {
      return (
        <div className="trans-container">
          <div className="trans-text-box">
            {Parser(
              DOMPurify.sanitize(this.state.dictText + "<address></address>") ||
                " ",
              {
                replace: (domNode) => {
                  if (this.state.dictService === "Yandex.Dictionary") {
                    if (domNode.name === "address") {
                      delete domNode.attribs.onclick;
                      return (
                        <p
                          onClick={() => {
                            openExternalUrl(
                              this.state.dictService
                                ? dictList.filter(
                                    (item) =>
                                      item.name === this.state.dictService
                                  )[0].url
                                : dictList[0].url
                            );
                          }}
                          className="dict-url"
                        >
                          {"Powered by " +
                            (this.state.dictService
                              ? this.state.dictService
                              : "Free Dictionary API")}
                        </p>
                      );
                    }
                  }
                },
              }
            )}
          </div>

          <div className="target-lang-container">
            <select
              className="booklist-shelf-list"
              style={{ width: "120px", margin: 0 }}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                this.setState({ dictService: event.target.value }, () => {
                  StorageUtil.setReaderConfig(
                    "dictService",
                    event.target.value
                  );
                  this.setState(
                    {
                      dictTarget: "en-en",
                    },
                    () => {
                      StorageUtil.setReaderConfig("dictTarget", "en-en");
                      this.handleDict(
                        this.props.originalText.replace(/(\r\n|\n|\r)/gm, "")
                      );
                    }
                  );
                });
              }}
            >
              {dictList.map((item, index) => {
                return (
                  <option
                    value={item.name}
                    key={index}
                    className="add-dialog-shelf-list-option"
                    selected={
                      this.state.dictService === item.name ? true : false
                    }
                  >
                    {item.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      );
    };
    return renderNoteEditor();
  }
}
export default PopupDict;