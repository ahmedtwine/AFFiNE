import { IconButton } from '@affine/component';
import { AffineErrorBoundary } from '@affine/core/components/affine/affine-error-boundary';
import { PageDetailEditor } from '@affine/core/components/page-detail-editor';
import { useRegisterBlocksuiteEditorCommands } from '@affine/core/hooks/affine/use-register-blocksuite-editor-commands';
import { useActiveBlocksuiteEditor } from '@affine/core/hooks/use-block-suite-editor';
import { useDocMetaHelper } from '@affine/core/hooks/use-block-suite-page-meta';
import { usePageDocumentTitle } from '@affine/core/hooks/use-global-state';
import { useNavigateHelper } from '@affine/core/hooks/use-navigate-helper';
import { EditorService } from '@affine/core/modules/editor';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { ViewService } from '@affine/core/modules/workbench/services/view';
import { DetailPageWrapper } from '@affine/core/pages/workspace/detail-page/detail-page-wrapper';
import type { PageRootService } from '@blocksuite/blocks';
import {
  BookmarkBlockService,
  customImageProxyMiddleware,
  EmbedGithubBlockService,
  EmbedLoomBlockService,
  EmbedYoutubeBlockService,
  ImageBlockService,
} from '@blocksuite/blocks';
import { DisposableGroup } from '@blocksuite/global/utils';
import { ShareIcon } from '@blocksuite/icons/rc';
import { type AffineEditorContainer } from '@blocksuite/presets';
import type { Doc as BlockSuiteDoc } from '@blocksuite/store';
import {
  DocService,
  FrameworkScope,
  GlobalContextService,
  useLiveData,
  useServices,
  WorkspaceService,
} from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { PageHeader } from '../../../components';
import { JournalIconButton } from './journal-icon-button';
import * as styles from './mobile-detail-page.css';
import { PageHeaderMenuButton } from './page-header-more-button';

const DetailPageImpl = () => {
  const { editorService, docService, workspaceService, globalContextService } =
    useServices({
      WorkbenchService,
      ViewService,
      EditorService,
      DocService,
      WorkspaceService,
      GlobalContextService,
    });
  const editor = editorService.editor;
  const workspace = workspaceService.workspace;
  const docCollection = workspace.docCollection;
  const globalContext = globalContextService.globalContext;
  const doc = docService.doc;

  const mode = useLiveData(editor.mode$);

  const isInTrash = useLiveData(doc.meta$.map(meta => meta.trash));
  const { openPage, jumpToPageBlock, jumpToTag } = useNavigateHelper();
  const editorContainer = useLiveData(editor.editorContainer$);

  const { setDocReadonly } = useDocMetaHelper(workspace.docCollection);

  // TODO(@eyhn): remove jotai here
  const [_, setActiveBlockSuiteEditor] = useActiveBlocksuiteEditor();

  useEffect(() => {
    setActiveBlockSuiteEditor(editorContainer);
  }, [editorContainer, setActiveBlockSuiteEditor]);

  useEffect(() => {
    globalContext.docId.set(doc.id);
    globalContext.isDoc.set(true);

    return () => {
      globalContext.docId.set(null);
      globalContext.isDoc.set(false);
    };
  }, [doc, globalContext]);

  useEffect(() => {
    globalContext.docMode.set(mode);

    return () => {
      globalContext.docMode.set(null);
    };
  }, [doc, globalContext, mode]);

  useEffect(() => {
    setDocReadonly(doc.id, true);
  }, [doc.id, setDocReadonly]);

  useEffect(() => {
    globalContext.isTrashDoc.set(!!isInTrash);

    return () => {
      globalContext.isTrashDoc.set(null);
    };
  }, [globalContext, isInTrash]);

  useRegisterBlocksuiteEditorCommands(editor);
  const title = useLiveData(doc.title$);
  usePageDocumentTitle(title);

  const onLoad = useCallback(
    (_bsPage: BlockSuiteDoc, editorContainer: AffineEditorContainer) => {
      // blocksuite editor host
      const editorHost = editorContainer.host;

      // provide image proxy endpoint to blocksuite
      editorHost?.std.clipboard.use(
        customImageProxyMiddleware(runtimeConfig.imageProxyUrl)
      );
      ImageBlockService.setImageProxyURL(runtimeConfig.imageProxyUrl);

      // provide link preview endpoint to blocksuite
      BookmarkBlockService.setLinkPreviewEndpoint(runtimeConfig.linkPreviewUrl);
      EmbedGithubBlockService.setLinkPreviewEndpoint(
        runtimeConfig.linkPreviewUrl
      );
      EmbedYoutubeBlockService.setLinkPreviewEndpoint(
        runtimeConfig.linkPreviewUrl
      );
      EmbedLoomBlockService.setLinkPreviewEndpoint(
        runtimeConfig.linkPreviewUrl
      );

      // provide page mode and updated date to blocksuite
      const pageService =
        editorHost?.std.spec.getService<PageRootService>('affine:page');
      const disposable = new DisposableGroup();
      if (pageService) {
        disposable.add(
          pageService.slots.docLinkClicked.on(({ docId, blockId }) => {
            return blockId
              ? jumpToPageBlock(docCollection.id, docId, blockId)
              : openPage(docCollection.id, docId);
          })
        );
        disposable.add(
          pageService.slots.tagClicked.on(({ tagId }) => {
            jumpToTag(workspace.id, tagId);
          })
        );
      }

      editor.setEditorContainer(editorContainer);

      return () => {
        disposable.dispose();
      };
    },
    [
      editor,
      jumpToPageBlock,
      docCollection.id,
      openPage,
      jumpToTag,
      workspace.id,
    ]
  );

  return (
    <FrameworkScope scope={editor.scope}>
      <div className={styles.mainContainer}>
        <div
          data-mode={mode}
          className={clsx(
            'affine-page-viewport',
            styles.affineDocViewport,
            styles.editorContainer
          )}
        >
          {/* Add a key to force rerender when page changed, to avoid error boundary persisting. */}
          <AffineErrorBoundary key={doc.id}>
            <JournalIconButton
              docId={doc.id}
              className={styles.journalIconButton}
            />
            <PageDetailEditor
              pageId={doc.id}
              onLoad={onLoad}
              docCollection={docCollection}
            />
          </AffineErrorBoundary>
        </div>
      </div>
    </FrameworkScope>
  );
};

export const Component = () => {
  const params = useParams();
  const pageId = params.pageId;

  if (!pageId) {
    return null;
  }

  return (
    <div className={styles.root}>
      <DetailPageWrapper pageId={pageId}>
        <PageHeader
          back
          className={styles.header}
          suffix={
            <>
              <IconButton
                size={24}
                style={{ padding: 10 }}
                onClick={console.log}
                icon={<ShareIcon />}
              />
              <PageHeaderMenuButton docId={pageId} />
            </>
          }
        />
        <DetailPageImpl />
      </DetailPageWrapper>
    </div>
  );
};
