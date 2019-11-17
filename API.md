# API List

## POST: /api/auth

Get an access token to enter a password.

All requests under this will return 401 error if the access token in the `x-access-token` of the header is missing or invalid.

* **Params**

  `password: string` **(Required) ** - A password to authenticate.

* **Response Data**

  `{ token: $SomeToken }`

## GET: /api/auth/check

Check the access token in the `x-access-token` of the header. It will return if it is correct, otherwise return 401 error.

- **Params**

  None

- **Response Data**

  None

## POST: /api/auth/refresh

Get a new access token.

- **Params**

  None

- **Response Data**

  `{ token: $newToken }`

------

## GET: /api/sites

Get a list of registered web site.

- **Params**

  None

- **Response Data**

  ```json
  [
    {
      _id: ,
      title: ,
      url: ,
      crawlUrl: ,
      cssSelector: ,
      lastUrl: ,
      category: ,
      checkingCycleSec: ,
      isDisabled: 
    },
    ...
  ]
  ```

  - **Example**

  ```json
  [
    {
      "_id":  "5d21f823a460e07c22acec13",
      "title": "Unity3d",
      "url": "https://unity3d.com/",
      "crawlUrl": "https://blogs.unity3d.com/",
      "cssSelector": ".post-heading > a",
      "lastUrl": "https://blogs.unity3d.com/2019/10/24/bridging-the-virtual-and-real-benefits-of-a-digital-twin/",
      "category": "Develop/Game",
      "checkingCycleSec": 3600,
      "isDisabled": false
    },
    ...
  ]
  ```

## POST: /api/site

Register a new web site.

- **Params**

  `title: string` **(Required) ** - A web site title.

  `url: string` **(Required) ** - A web site url.

  `crawlUrl: string` **(Required) ** - A url to check for new post.

  `cssSelector: string` **(Required) ** - A CSS Selector to check for new post.

  `category: string` - A category. *(Default: general)*

  `checkingCycleSec: number` - Cycle in seconds to check for new post. *(Default: 900)*

- **Response Data**

  None

## PUT: /api/site/:id

Update the web site.

- **Params**

  `crawlUrl: string` - A url to check for new post.

  `cssSelector: string` - A CSS Selector to check for new post.

  `category: string` - A category to update.

  `checkingCycleSec: number` - Cycle in seconds to check for new post.

  `isDisabled: boolean` - Disable the web site.

- **Response Data**

  None

## DELETE: /api/site/:id

Delete the web site.

- **Params**

  `deleteAllPages: boolean` -  Also delete pages of the site. *(Default: false)*

- **Response Data**

  None

-----

## GET: /api/pages

Get a list of saved pages. It returns from latest page.

- **Params**

  `onlyUnread: boolean` - Only unread pages. *(Default: false)*

  `category: string` - Only belong to the category. *(Default: null -> All categories)*

  `categoryWithSub: boolean` - Also with sub category of the category. *(Default: true)*

  `startIndex: number` - Return after the number of pages. *(Default: 0)*

  `afterId: string` - Return after the page with the ID. If this parameter is set, `startIndex` parameter is ignored.

  `count: number` - A number of pages to get. *(Default: null -> All pages)*

- **Response Data**

  ```json
  [
    {
      _id: ,
      siteId: ,
      siteTitle: ,
      title: ,
      url: ,
      imageUrl: ,
      desc: ,
      category: ,
      time: ,
      isRead: false,
      isArchieved: false
    },
    ...
  ]
  ```

  - Example

  ```json
  [
    {
      "_id": "5db1cb341ce9c3410f0d4bcd",
      "siteId": "5d21f823a460e07c22acec13",
      "siteTitle": "Unity3d",
      "title": "Bridging the virtual and real: Benefits of a digital twin – Unity Blog",
      "url": "https://blogs.unity3d.com/2019/10/24/bridging-the-virtual-and-real-benefits-of-a-digital-twin/",
      "imageUrl": "page_data/5db1cb341ce9c3410f0d4bcd/image.png",
      "desc": "Get up to speed on how digital twin technology is changing how manufactured products and infrastructure projects are designed, brought to market, and maint...",
      "category": "Develop/Game",
      "time": "2019-10-24T16:03:00.678Z",
      "isRead": false,
      "isArchieved": false
    },
    ...
  ]
  ```

## GET: /api/pages/archieved

Get an list of archived pages.

- **Params**

  Same as **GET: /api/pages**

- **Response Data**

  Same as **GET: /api/pages**

## DELETE: /api/page/:id

Delete the page.

- **Params**

  None

- **Response Data**

  None

## PUT: /api/page/read/:id

Mark the page as read.

- **Params**

  `setUnread: boolean` - Mark as unread. *(Default: false)*

- **Response Data**

  None

## POST: /api/page/archieved

Archive the page.

- **Params**

  `url: string` **(Required) ** - A page url to archive.

  `category: string` **(Required) ** - A category.

- **Response Data**

  ```json
  {
    _id: ,
    siteId: ,
    siteTitle: ,
    title: ,
    url: ,
    imageUrl: ,
    desc: ,
    category: ,
    time: ,
    isRead: true,
    isArchieved: true
  }
  ```

## POST: /api/page/archieved/:id

Archive the page from saved pages.

- **Params**

  None

- **Response Data**

  None

-----

## GET: /api/category

카테고리들을 가져옴.

- **Params**

  `name: string` - A category name. *(Default: null -> All categories)*

  `withSub: boolean` - Also get sub categories of the category. *(Default: true)*

- **Response Data**

  `[ $Category1, $Category2, ... ]`

## POST: /api/category

Add a new category.

- **Params**

  `name: string` **(Required) ** - A category name.

- **Response Data**

  None

## DELETE: /api/category

Remove the category.

- **Params**

  `name: string` **(Required) ** - A category name to remove.

- **Response Data**

  None