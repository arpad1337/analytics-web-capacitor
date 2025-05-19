import { environment } from './environments/environment';
import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';
import { Capacitor } from '@capacitor/core';

const bootstrapApp = async () => {
  // launch your app
}

const setImmediate = (cb: () => void) => {
  setTimeout(cb, 0);
};

class DataLayerArray extends Array<unknown> {
  static override from(arrayLike: ArrayLike<unknown>): DataLayerArray {
    return super.from(arrayLike);
  }

  override push(...items: unknown[]) {
    return super.push(...items);
  }

  static override [Symbol.hasInstance](instance: unknown) {
    if (!!instance && instance instanceof Array) {
      return true;
    }
    return false;
  }
}

class Analytics {
  protected analyticsId: string;
  protected gtmId: string;

  constructor(analyticsId: string, gtmId: string) {
    this.analyticsId = analyticsId;
    this.gtmId = gtmId;
  }

  public async loadAnalytics() {
    const isWeb =
      (window.location.origin.indexOf('://app-symbol') === -1);
    const host = isWeb ? '' : '//app-symbol';

    const windowRef: Window & {
      dataLayer?: DataLayerArray;
      gtag?: Function;
    } = window;

    windowRef['dataLayer'] = !!windowRef['dataLayer']
      ? DataLayerArray.from(windowRef['dataLayer'])
      : new DataLayerArray();

    windowRef['gtag'] = function gtag() {
      windowRef['dataLayer']!.push(Array.from(arguments));
    };

    let dataLayer: any[] = new DataLayerArray();

    if (!isWeb) {
      dataLayer = this.setFirebaseBridgedTrackingProxy(dataLayer);
    }

    dataLayer = this.setGTMHistoryChangeEventProxy(dataLayer);

    windowRef['dataLayer'].forEach((e) => dataLayer.push(e));
    windowRef['dataLayer'] = dataLayer;

    await new Promise(async (r: (v: boolean) => void, e: () => void) => {
      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function () {
        if (this.readyState != 4) {
          return;
        }

        windowRef['dataLayer']!.push({
          'gtm.start': new Date().getTime(),
          event: 'gtm.js',
        });

        eval(xhr.responseText);

        r(true);
      };

      xhr.onerror = () => {
        console.error('Cloud not load GTM.');
        e();
      };
      xhr.open('GET', `${host}/assets/gtm.js?id=${this.gtmId}`);
      xhr.send();
    });

    await new Promise(async (r: (v: boolean) => void, e: () => void) => {
      const xhr = new XMLHttpRequest();

      if (!isWeb) {
        await FirebaseAnalytics.enable();
      }

      const self = this;

      xhr.onreadystatechange = function () {
        if (this.readyState != 4) {
          return;
        }

        const analyticsId = self.analyticsId;

        eval(xhr.responseText);

        if (!isWeb) {
          windowRef['gtag']!('set', { checkProtocolTask: function () {} });
        }

        windowRef['gtag']!('js', new Date());

        windowRef['gtag']!('config', analyticsId, {
          send_page_view: true,
        });

        setImmediate(() => {
          let path = document.location.href.substring(
            document.location.href.indexOf('://') + 3
          );

          path = path.substring(path.indexOf('/'));

          const params = {
            page_location: document.location.href,
            page_title: document.title,
            virtual_page_location: path,
            os: 'web',
          };

          // @ts-ignore
          !!environment.debug && (params.traffic_type = 'internal');

          // @ts-ignore
          windowRef['gtag']('event', 'application_opened', params);
        });

        r(true);
      };
      xhr.onerror = () => {
        console.error('Cloud not load Analytics.');
        e();
      };
      xhr.open('GET', `${host}/assets/tracking.js?id=${this.analyticsId}`);
      xhr.send();
    });

    console.log('Analytics loaded.');
  }

  private setGTMHistoryChangeEventProxy(
    dataLayer: DataLayerArray
  ): DataLayerArray {
    const pushHandler = dataLayer.push.bind(dataLayer);
    const proxyForDataLayerHandler = function (
      this: DataLayerArray,
      value: Object | Array<any>
    ) {
      let _: any, _2: any, _3: any;
      if (Array.isArray(value)) {
        [_, _2, _3] = value;
        if (_ === 'event' && !!_3) {
          value[2] = _3 = JSON.parse(
            JSON.stringify({
              ..._3,
              os: 'web',
              traffic_type: environment.debug ? 'internal' : undefined,
            })
          );
        }
      } else {
        _ = value;
      }
      if (_ instanceof Object && 'event' in _) {
        switch (_.event) {
          case 'gtm.historyChange-v2': {
            setImmediate(() => {
              let newUrl = _['gtm.newUrl'].substring(
                _['gtm.newUrl'].indexOf('://') + 3
              );
              let oldUrl = _['gtm.oldUrl'].substring(
                _['gtm.oldUrl'].indexOf('://') + 3
              );

              newUrl = newUrl.substring(newUrl.indexOf('/'));
              oldUrl = oldUrl.substring(oldUrl.indexOf('/'));

              const params = {
                page_location: _['gtm.newUrl'],
                page_referrer: _['gtm.oldUrl'],
                page_title: document.title,
                virtual_page_location: newUrl,
                virtual_page_referrer: oldUrl,
                os: 'web',
              };

              // @ts-ignore
              !!environment.debug && (params.traffic_type = 'internal');

              pushHandler.call(this, ['event', 'page_view', params]);
            });
            break;
          }
        }
      }
      return pushHandler.call(this, value);
    };

    dataLayer.push = proxyForDataLayerHandler.bind(dataLayer);

    return dataLayer;
  }

  private setFirebaseBridgedTrackingProxy(
    dataLayer: DataLayerArray
  ): DataLayerArray {
    console.log(`Connecting Firebase...`);
    const pushHandler = dataLayer.push.bind(dataLayer);
    const proxyForDataLayerHandler = function (
      this: DataLayerArray,
      value: Object | Array<any>
    ) {
      if (Array.isArray(value) && value[0] === 'event') {
        let [_, event, params] = value;
        if (!!event) {
          if (!params.os || params.os === 'web') {
            value[2] = params = {
              ...params,
              os: Capacitor.getPlatform(),
            };
          }
          setImmediate(async () => {
            await FirebaseAnalytics.logEvent({
              name: event,
              params: {
                ...params,
              },
            });
          });
        }
      }
      return pushHandler.call(this, value);
    };

    dataLayer.push = proxyForDataLayerHandler.bind(dataLayer)

    return dataLayer;
  }
}

const analyticsID = "G-**********";
const tagManagerID = "GTM-********";

new Analytics(analyticsID, tagManagerID).loadAnalytics().then(() => {
  bootstrapApp();
});
